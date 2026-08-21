/**
 * POST /api/internal/prospects/import
 *
 * Bulk-import prospects into a campaign without going through the sourcer.
 * Use this when you already have a list (PaintPulse Supabase, LinkRescue
 * scan results, a CSV, anywhere). The pipeline cron will pick them up on
 * its next run, or trigger /api/internal/scan-batch directly.
 *
 *   curl -X POST -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
 *        -H "Content-Type: application/json" \
 *        -d '{"campaignId":"...","prospects":[{"target":"example.com","contactEmail":"a@b.co"}]}' \
 *        https://demodraft.app/api/internal/prospects/import
 *
 * Body:
 *   { campaignId: string, prospects: Array<{target, contactEmail?, contactName?}> }
 *
 * Returns:
 *   200 { ok, submitted, inserted, alreadyExisted, skipped, errors }
 *   400 { error } — bad payload
 *   401/503 — auth issues (see internal-auth)
 *   404 { error: "Campaign not found" }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireInternalAuth,
  isInternalAuthSuccess,
} from "@/lib/security/internal-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BATCH = 500;

interface ProspectInputRaw {
  target?: unknown;
  contactEmail?: unknown;
  contactName?: unknown;
}

interface NormalizedProspect {
  target: string;
  contact_email: string | null;
  contact_name: string | null;
}

function normalizeTarget(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const stripped = trimmed
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
  // Must look domain-like: at least one dot, no whitespace.
  if (!stripped.includes(".") || /\s/.test(stripped)) return null;
  return stripped;
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("@")) return null;
  return trimmed;
}

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

export async function POST(request: NextRequest) {
  const auth = requireInternalAuth(request);
  if (!isInternalAuthSuccess(auth)) return auth;

  let body: { campaignId?: unknown; prospects?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
  const rawProspects = Array.isArray(body.prospects) ? body.prospects : null;

  if (!campaignId) {
    return NextResponse.json(
      { error: "campaignId (string) is required" },
      { status: 400 }
    );
  }
  if (!rawProspects || rawProspects.length === 0) {
    return NextResponse.json(
      { error: "prospects (non-empty array) is required" },
      { status: 400 }
    );
  }
  if (rawProspects.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `prospects array too large (max ${MAX_BATCH})` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verify campaign belongs to this owner.
  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .select("id, user_id")
    .eq("id", campaignId)
    .eq("user_id", auth.ownerId)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json(
      { error: "Campaign not found" },
      { status: 404 }
    );
  }

  // Normalize input. Track skip count and per-row errors.
  const normalized: NormalizedProspect[] = [];
  const errors: { index: number; reason: string }[] = [];
  const seen = new Set<string>();

  rawProspects.forEach((raw, idx) => {
    const item = raw as ProspectInputRaw;
    if (typeof item.target !== "string") {
      errors.push({ index: idx, reason: "target must be a string" });
      return;
    }
    const target = normalizeTarget(item.target);
    if (!target) {
      errors.push({ index: idx, reason: `invalid target: ${item.target}` });
      return;
    }
    if (seen.has(target)) {
      errors.push({ index: idx, reason: `duplicate target in batch: ${target}` });
      return;
    }
    seen.add(target);
    normalized.push({
      target,
      contact_email: normalizeEmail(item.contactEmail),
      contact_name: normalizeName(item.contactName),
    });
  });

  const submitted = rawProspects.length;
  const skipped = errors.length;

  if (normalized.length === 0) {
    return NextResponse.json(
      { ok: true, submitted, inserted: 0, alreadyExisted: 0, skipped, errors },
      { status: 200 }
    );
  }

  // Find which targets already exist for this campaign — leave them alone
  // so we don't reset their status back to 'queued'.
  const { data: existing } = await admin
    .from("prospects")
    .select("target")
    .eq("campaign_id", campaignId)
    .in(
      "target",
      normalized.map((p) => p.target)
    );

  const existingSet = new Set(
    (existing ?? []).map((row: { target: string }) => row.target)
  );
  const toInsert = normalized.filter((p) => !existingSet.has(p.target));

  if (toInsert.length === 0) {
    return NextResponse.json({
      ok: true,
      submitted,
      inserted: 0,
      alreadyExisted: normalized.length,
      skipped,
      errors,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = toInsert.map((p) => ({
    campaign_id: campaignId,
    user_id: auth.ownerId,
    target: p.target,
    contact_email: p.contact_email,
    contact_name: p.contact_name,
    status: "queued",
    queued_for: today,
  }));

  const { error: insertError, count } = await admin
    .from("prospects")
    .insert(rows, { count: "exact" });

  if (insertError) {
    return NextResponse.json(
      { error: `Insert failed: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    submitted,
    inserted: count ?? toInsert.length,
    alreadyExisted: normalized.length - toInsert.length,
    skipped,
    errors,
  });
}
