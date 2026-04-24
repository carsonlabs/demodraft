/**
 * DemoDraft Pipeline
 *
 * Orchestrates: scan prospect → generate PDF → compose email → store draft
 * All output goes to Supabase (drafts table + Storage for PDFs).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { scanProspect, composeEmail } from "./scanner";
import { generatePdfBuffer } from "./pdf";
import type { CampaignConfig, ProspectInput, DraftResult } from "./types";

function slugify(target: string): string {
  return target
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/-+$/, "")
    .toLowerCase();
}

/**
 * Process a single prospect through the full pipeline.
 */
export async function processProspect(
  supabase: SupabaseClient,
  campaign: CampaignConfig,
  prospect: ProspectInput
): Promise<DraftResult> {
  const slug = slugify(prospect.target);
  const pdfFilename = `${slug}-report.pdf`;

  try {
    // 1. Update prospect status
    await supabase
      .from("prospects")
      .update({ status: "processing" })
      .eq("id", prospect.id);

    // 2. Scan the prospect's website
    console.log(`  Scanning ${prospect.target}...`);
    const scanResult = await scanProspect(prospect.target, campaign);
    console.log(`  Score: ${scanResult.overallScore}/100 (${scanResult.grade})`);

    // 3. Generate branded PDF
    console.log(`  Generating PDF...`);
    const pdfBuffer = await generatePdfBuffer(scanResult, campaign.brand, {
      ctaPage: campaign.ctaSteps,
      pricing: campaign.pricing,
    });

    // 4. Upload PDF to Supabase Storage
    const storagePath = `${campaign.userId}/${campaign.id}/${slug}/${pdfFilename}`;
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`PDF upload failed: ${uploadError.message}`);
    }

    // 5. Compose personalized email
    const email = composeEmail(scanResult, campaign, prospect.contactEmail);

    // 6. Store draft in database. `pdf_url` holds the storage path (not a public URL);
    // the /api/drafts/[id]/pdf route mints a short-TTL signed URL for the owner.
    const { error: draftError } = await supabase.from("drafts").insert({
      prospect_id: prospect.id,
      campaign_id: campaign.id,
      user_id: campaign.userId,
      scan_score: scanResult.overallScore,
      scan_grade: scanResult.grade,
      scan_data: scanResult,
      pdf_url: storagePath,
      pdf_filename: pdfFilename,
      email_to: prospect.contactEmail,
      email_subject: email.subject,
      email_body: email.body,
      status: "ready",
      completed_at: new Date().toISOString(),
    });

    if (draftError) {
      throw new Error(`Draft insert failed: ${draftError.message}`);
    }

    // 7. Update prospect status
    await supabase
      .from("prospects")
      .update({ status: "completed" })
      .eq("id", prospect.id);

    return {
      prospectId: prospect.id,
      target: prospect.target,
      displayName: scanResult.displayName,
      scanScore: scanResult.overallScore,
      scanGrade: scanResult.grade,
      scanData: scanResult,
      pdfBuffer,
      pdfFilename,
      emailTo: prospect.contactEmail ?? null,
      emailSubject: email.subject,
      emailBody: email.body,
      status: "success",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`  FAILED: ${message}`);

    // Update prospect as failed
    await supabase
      .from("prospects")
      .update({ status: "failed" })
      .eq("id", prospect.id);

    // Store error draft
    await supabase.from("drafts").insert({
      prospect_id: prospect.id,
      campaign_id: campaign.id,
      user_id: campaign.userId,
      status: "error",
      error_message: message,
    });

    return {
      prospectId: prospect.id,
      target: prospect.target,
      displayName: prospect.target,
      scanScore: 0,
      scanGrade: "?",
      scanData: { target: prospect.target, displayName: prospect.target, overallScore: 0, grade: "?", categories: [], checks: [] },
      pdfBuffer: Buffer.alloc(0),
      pdfFilename: "",
      emailTo: prospect.contactEmail ?? null,
      emailSubject: "",
      emailBody: "",
      status: "error",
      error: message,
    };
  }
}

/**
 * Run the pipeline for a batch of prospects (daily cron or manual trigger).
 * Processes up to `concurrency` prospects in parallel for speed.
 */
export async function runBatch(
  supabase: SupabaseClient,
  campaign: CampaignConfig,
  prospects: ProspectInput[],
  concurrency = 3
): Promise<{ succeeded: number; failed: number; results: DraftResult[] }> {
  console.log(`\nDemoDraft Pipeline — ${campaign.brand.company}`);
  console.log(`Processing ${prospects.length} prospects (concurrency: ${concurrency})...\n`);

  const results: DraftResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let completed = 0;

  // Process in chunks of `concurrency`
  for (let i = 0; i < prospects.length; i += concurrency) {
    const chunk = prospects.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (prospect, j) => {
        console.log(`[${i + j + 1}/${prospects.length}] ${prospect.target}`);
        return processProspect(supabase, campaign, prospect);
      })
    );

    for (const settled of chunkResults) {
      completed++;
      if (settled.status === "fulfilled") {
        results.push(settled.value);
        if (settled.value.status === "success") succeeded++;
        else failed++;
      } else {
        failed++;
      }
    }
  }

  console.log(`\nComplete: ${succeeded} succeeded, ${failed} failed`);
  return { succeeded, failed, results };
}

/**
 * Build a CampaignConfig from a database campaign row.
 */
export function campaignRowToConfig(row: Record<string, unknown>): CampaignConfig {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    brand: {
      name: row.brand_name as string,
      company: row.brand_company as string,
      site: (row.brand_site as string) ?? "",
      email: row.brand_email as string,
      calendarLink: (row.brand_calendar_link as string) ?? "",
      tagline: (row.brand_tagline as string) ?? "",
      colors: {
        primary: (row.brand_color_primary as string) ?? "#6366f1",
        dark: (row.brand_color_dark as string) ?? "#1e1b4b",
      },
    },
    valueProposition: row.value_prop as string,
    productDescription: row.product_description as string,
    analysisPrompt: row.analysis_prompt as string | undefined,
    emailTemplate: row.email_template as string | undefined,
    pdfTemplate: (row.pdf_template as "standard" | "minimal" | "bold") ?? "standard",
    dailyProspectCount: (row.daily_prospect_count as number) ?? 10,
  };
}
