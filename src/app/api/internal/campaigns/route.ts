/**
 * POST /api/internal/campaigns
 *
 * Create a new campaign from a JSON config. Designed for internal tools to
 * spin up new campaigns programmatically (e.g., when Carson launches a new
 * product, his repo can hold a `campaign.json` template that gets POSTed).
 *
 *   curl -X POST -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
 *        -H "Content-Type: application/json" \
 *        -d @campaign.json \
 *        https://demodraft.app/api/internal/campaigns
 *
 * Body shape mirrors CampaignConfig (nested), with two ICP fields added:
 *   {
 *     name: string,
 *     status?: "active" | "paused" | "archived",
 *     brand: { name, company, site?, email, calendarLink?, tagline?, colors?: { primary?, dark? } },
 *     valueProposition: string,
 *     productDescription: string,
 *     analysisPrompt?: string,
 *     emailTemplate?: string,
 *     pdfTemplate?: "standard" | "minimal" | "bold",
 *     dailyProspectCount?: number,
 *     icp?: { description?: string, industry?: string, keywords?: string },
 *     gmailDraft?: boolean
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireInternalAuth,
  isInternalAuthSuccess,
} from "@/lib/security/internal-auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface CampaignInput {
  name?: unknown;
  status?: unknown;
  brand?: {
    name?: unknown;
    company?: unknown;
    site?: unknown;
    email?: unknown;
    calendarLink?: unknown;
    tagline?: unknown;
    colors?: { primary?: unknown; dark?: unknown };
  };
  valueProposition?: unknown;
  productDescription?: unknown;
  analysisPrompt?: unknown;
  emailTemplate?: unknown;
  pdfTemplate?: unknown;
  dailyProspectCount?: unknown;
  icp?: { description?: unknown; industry?: unknown; keywords?: unknown };
  gmailDraft?: unknown;
}

const VALID_STATUS = new Set(["active", "paused", "archived"]);
const VALID_PDF_TEMPLATE = new Set(["standard", "minimal", "bold"]);

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asOptionalString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function buildCampaignRow(
  input: CampaignInput,
  ownerId: string
): { row?: Record<string, unknown>; error?: string } {
  const name = asString(input.name);
  if (!name) return { error: "name is required" };

  const valueProposition = asString(input.valueProposition);
  if (!valueProposition) return { error: "valueProposition is required" };

  const productDescription = asString(input.productDescription);
  if (!productDescription) return { error: "productDescription is required" };

  const status = asOptionalString(input.status) ?? "active";
  if (!VALID_STATUS.has(status)) {
    return { error: `status must be one of ${[...VALID_STATUS].join(", ")}` };
  }

  const pdfTemplate = asOptionalString(input.pdfTemplate) ?? "standard";
  if (!VALID_PDF_TEMPLATE.has(pdfTemplate)) {
    return {
      error: `pdfTemplate must be one of ${[...VALID_PDF_TEMPLATE].join(", ")}`,
    };
  }

  const dailyProspectCount =
    typeof input.dailyProspectCount === "number"
      ? Math.max(0, Math.floor(input.dailyProspectCount))
      : 10;

  const brand = input.brand ?? {};
  const colors = brand.colors ?? {};

  return {
    row: {
      user_id: ownerId,
      name,
      status,
      brand_name: asOptionalString(brand.name),
      brand_company: asOptionalString(brand.company),
      brand_site: asOptionalString(brand.site),
      brand_email: asOptionalString(brand.email),
      brand_calendar_link: asOptionalString(brand.calendarLink),
      brand_tagline: asOptionalString(brand.tagline),
      brand_color_primary: asOptionalString(colors.primary) ?? "#6366f1",
      brand_color_dark: asOptionalString(colors.dark) ?? "#1e1b4b",
      value_prop: valueProposition,
      product_description: productDescription,
      analysis_prompt: asOptionalString(input.analysisPrompt),
      email_template: asOptionalString(input.emailTemplate),
      pdf_template: pdfTemplate,
      daily_prospect_count: dailyProspectCount,
      icp_description: asOptionalString(input.icp?.description),
      icp_industry: asOptionalString(input.icp?.industry),
      icp_keywords: asOptionalString(input.icp?.keywords),
      gmail_draft: Boolean(input.gmailDraft),
    },
  };
}

export async function POST(request: NextRequest) {
  const auth = requireInternalAuth(request);
  if (!isInternalAuthSuccess(auth)) return auth;

  let body: CampaignInput;
  try {
    body = (await request.json()) as CampaignInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { row, error } = buildCampaignRow(body, auth.ownerId);
  if (error || !row) {
    return NextResponse.json({ error: error ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: created, error: insertError } = await admin
    .from("campaigns")
    .insert(row)
    .select()
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, campaign: created }, { status: 201 });
}
