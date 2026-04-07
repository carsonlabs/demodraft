/**
 * Usage Analytics Module
 * 
 * Tracks API usage, performance metrics, and user behavior
 * for monitoring and billing purposes.
 */

import { createClient } from "@supabase/supabase-js";

interface UsageEvent {
  event_type: "api_call" | "pdf_generated" | "email_sent" | "scan_completed" | "error";
  user_id?: string;
  campaign_id?: string;
  prospect_id?: string;
  metadata?: Record<string, unknown>;
  duration_ms?: number;
  timestamp: string;
}

let _enabled = false;

export function initAnalytics(): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _enabled = !!(supabaseUrl && supabaseKey);
  
  if (_enabled) {
    console.log("[Analytics] Initialized");
  }
}

async function trackEvent(event: UsageEvent): Promise<void> {
  if (!_enabled) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error } = await supabase.from("usage_events").insert({
      event_type: event.event_type,
      user_id: event.user_id,
      campaign_id: event.campaign_id,
      prospect_id: event.prospect_id,
      metadata: event.metadata,
      duration_ms: event.duration_ms,
      timestamp: event.timestamp,
    });

    if (error) {
      console.warn("[Analytics] Failed to track event:", error.message);
    }
  } catch (err) {
    console.warn("[Analytics] Error tracking event:", err instanceof Error ? err.message : err);
  }
}

export async function trackApiCall(
  endpoint: string,
  method: string,
  userId?: string,
  durationMs?: number,
  statusCode?: number
): Promise<void> {
  await trackEvent({
    event_type: "api_call",
    user_id: userId,
    metadata: { endpoint, method, status_code: statusCode },
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  });
}

export async function trackScanCompleted(
  userId: string,
  campaignId: string,
  prospectId: string,
  score: number,
  durationMs: number
): Promise<void> {
  await trackEvent({
    event_type: "scan_completed",
    user_id: userId,
    campaign_id: campaignId,
    prospect_id: prospectId,
    metadata: { score },
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  });
}

export async function trackPdfGenerated(
  userId: string,
  campaignId: string,
  prospectId: string,
  durationMs: number
): Promise<void> {
  await trackEvent({
    event_type: "pdf_generated",
    user_id: userId,
    campaign_id: campaignId,
    prospect_id: prospectId,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  });
}

export async function trackError(
  errorType: string,
  errorMessage: string,
  userId?: string,
  context?: Record<string, unknown>
): Promise<void> {
  await trackEvent({
    event_type: "error",
    user_id: userId,
    metadata: { error_type: errorType, message: errorMessage, ...context },
    timestamp: new Date().toISOString(),
  });
}

export async function getUserUsageStats(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalScans: number;
  totalPdfs: number;
  totalApiCalls: number;
  avgScanDuration: number;
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return { totalScans: 0, totalPdfs: 0, totalApiCalls: 0, avgScanDuration: 0 };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    const [scans, pdfs, apiCalls] = await Promise.all([
      supabase
        .from("usage_events")
        .select("duration_ms", { count: "exact" })
        .eq("user_id", userId)
        .eq("event_type", "scan_completed")
        .gte("timestamp", startStr)
        .lte("timestamp", endStr),
      
      supabase
        .from("usage_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "pdf_generated")
        .gte("timestamp", startStr)
        .lte("timestamp", endStr),
      
      supabase
        .from("usage_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "api_call")
        .gte("timestamp", startStr)
        .lte("timestamp", endStr),
    ]);

    const scanDurations = scans.data?.filter(s => s.duration_ms).map(s => s.duration_ms as number) ?? [];
    const avgScanDuration = scanDurations.length > 0
      ? scanDurations.reduce((a, b) => a + b, 0) / scanDurations.length
      : 0;

    return {
      totalScans: scans.count ?? 0,
      totalPdfs: pdfs.count ?? 0,
      totalApiCalls: apiCalls.count ?? 0,
      avgScanDuration: Math.round(avgScanDuration),
    };
  } catch (err) {
    console.error("[Analytics] Error fetching usage stats:", err instanceof Error ? err.message : err);
    return { totalScans: 0, totalPdfs: 0, totalApiCalls: 0, avgScanDuration: 0 };
  }
}

// Auto-initialize
initAnalytics();
