/**
 * POST /api/pipeline/first-run
 *
 * Triggered after campaign creation. Sources prospects based on ICP
 * and processes the first batch immediately so the user sees results.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sourceProspects } from "@/lib/engine/sourcer";
import { processProspect, campaignRowToConfig } from "@/lib/engine/pipeline";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await request.json();
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  // Load campaign
  const admin = createAdminClient();
  const { data: campaign, error: campError } = await admin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (campError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Source prospects based on ICP
  const alreadyScanned = new Set<string>();
  const { data: existing } = await admin
    .from("prospects")
    .select("target")
    .eq("campaign_id", campaignId);

  if (existing) {
    existing.forEach((p) => alreadyScanned.add(p.target.toLowerCase()));
  }

  const prospects = await sourceProspects({
    icpDescription: campaign.icp_description ?? "",
    icpIndustry: campaign.icp_industry ?? "",
    icpKeywords: campaign.icp_keywords ?? "",
    count: 10,
    alreadyScanned,
  });

  if (prospects.length === 0) {
    return NextResponse.json({ error: "No prospects found for this ICP" }, { status: 404 });
  }

  // Insert prospects
  const prospectRows = prospects.map((target) => ({
    campaign_id: campaignId,
    user_id: user.id,
    target,
    status: "queued",
    queued_for: new Date().toISOString().slice(0, 10),
  }));

  const { data: inserted } = await admin
    .from("prospects")
    .upsert(prospectRows, { onConflict: "campaign_id,target" })
    .select();

  if (!inserted || inserted.length === 0) {
    return NextResponse.json({ error: "Failed to create prospects" }, { status: 500 });
  }

  // Process first 3 immediately (rest will be picked up by cron)
  const config = campaignRowToConfig(campaign);
  const immediate = inserted.slice(0, 3);
  let succeeded = 0;

  for (const prospect of immediate) {
    try {
      const result = await processProspect(admin, config, {
        id: prospect.id,
        target: prospect.target,
        contactEmail: prospect.contact_email,
        contactName: prospect.contact_name,
      });
      if (result.status === "success") succeeded++;
    } catch {
      // Continue with next prospect
    }
  }

  return NextResponse.json({
    status: "success",
    prospectsFound: prospects.length,
    processedImmediately: immediate.length,
    succeeded,
    message: `Found ${prospects.length} prospects. ${succeeded} demos ready now, rest processing in background.`,
  });
}
