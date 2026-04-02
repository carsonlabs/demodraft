/**
 * POST /api/pipeline/scan
 *
 * Scan a single prospect URL for a campaign.
 * Used for testing and the "Try it now" onboarding flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processProspect, campaignRowToConfig } from "@/lib/engine/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { campaignId, target, contactEmail, contactName } = body;

  if (!campaignId || !target) {
    return NextResponse.json(
      { error: "campaignId and target are required" },
      { status: 400 }
    );
  }

  // Load campaign
  const { data: campaign, error: campError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (campError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Check daily usage limit
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_limit, plan")
    .eq("id", user.id)
    .single();

  if (profile && profile.daily_limit > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from("drafts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", `${today}T00:00:00Z`)
      .neq("status", "error");

    if ((count ?? 0) >= profile.daily_limit) {
      return NextResponse.json(
        { error: `Daily limit of ${profile.daily_limit} drafts reached` },
        { status: 429 }
      );
    }
  }

  // Upsert prospect
  const admin = createAdminClient();
  const { data: prospect, error: prospectError } = await admin
    .from("prospects")
    .upsert(
      {
        campaign_id: campaignId,
        user_id: user.id,
        target,
        contact_email: contactEmail || null,
        contact_name: contactName || null,
        status: "queued",
        queued_for: new Date().toISOString().slice(0, 10),
      },
      { onConflict: "campaign_id,target" }
    )
    .select()
    .single();

  if (prospectError || !prospect) {
    return NextResponse.json(
      { error: "Failed to create prospect" },
      { status: 500 }
    );
  }

  // Run the pipeline
  const config = campaignRowToConfig(campaign);
  const result = await processProspect(admin, config, {
    id: prospect.id,
    target: prospect.target,
    contactEmail: prospect.contact_email,
    contactName: prospect.contact_name,
  });

  if (result.status === "error") {
    return NextResponse.json(
      { error: result.error, status: "error" },
      { status: 500 }
    );
  }

  // Get the PDF URL from the draft we just inserted
  const { data: insertedDraft } = await admin
    .from("drafts")
    .select("pdf_url")
    .eq("prospect_id", prospect.id)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    status: "success",
    draft: {
      target: result.target,
      displayName: result.displayName,
      score: result.scanScore,
      grade: result.scanGrade,
      pdfUrl: insertedDraft?.pdf_url ?? null,
      emailSubject: result.emailSubject,
      emailBody: result.emailBody,
    },
  });
}
