/**
 * POST /api/cron/morning
 *
 * Daily pipeline trigger. Called by Vercel Cron.
 * Processes queued prospects for all active campaigns.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runBatch, campaignRowToConfig } from "@/lib/engine/pipeline";

export const maxDuration = 300; // 5 minutes (Vercel Pro)

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // Get all active campaigns
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "active");

  if (error || !campaigns) {
    return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 });
  }

  const summary: Record<string, { succeeded: number; failed: number }> = {};

  for (const campaign of campaigns) {
    const config = campaignRowToConfig(campaign);

    // Check user's daily limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_limit, plan")
      .eq("id", campaign.user_id)
      .single();

    if (!profile || profile.daily_limit === 0) continue;

    // Count today's drafts for this user
    const { count: todayCount } = await supabase
      .from("drafts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", campaign.user_id)
      .gte("created_at", `${today}T00:00:00Z`)
      .neq("status", "error");

    const remaining = Math.max(0, profile.daily_limit - (todayCount ?? 0));
    if (remaining === 0) continue;

    // Get queued prospects for today
    const limit = Math.min(remaining, config.dailyProspectCount);
    const { data: prospects } = await supabase
      .from("prospects")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (!prospects || prospects.length === 0) continue;

    // Create pipeline run record
    const { data: run } = await supabase
      .from("pipeline_runs")
      .insert({
        user_id: campaign.user_id,
        campaign_id: campaign.id,
        run_date: today,
        status: "running",
        total_prospects: prospects.length,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Process batch
    const result = await runBatch(
      supabase,
      config,
      prospects.map((p) => ({
        id: p.id,
        target: p.target,
        contactEmail: p.contact_email,
        contactName: p.contact_name,
      }))
    );

    // Update pipeline run
    if (run) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          succeeded: result.succeeded,
          failed: result.failed,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }

    summary[campaign.name] = {
      succeeded: result.succeeded,
      failed: result.failed,
    };
  }

  return NextResponse.json({ date: today, campaigns: summary });
}
