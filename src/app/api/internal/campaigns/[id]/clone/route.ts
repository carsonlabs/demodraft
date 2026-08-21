/**
 * POST /api/internal/campaigns/[id]/clone
 *
 * Clone an existing campaign — copies every config field except id/timestamps.
 * Optional body lets you override fields on the clone (most commonly `name`).
 *
 *   curl -X POST -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
 *        -H "Content-Type: application/json" \
 *        -d '{"name":"PaintPulse Q3 outreach","gmailDraft":true}' \
 *        https://demodraft.app/api/internal/campaigns/<source-id>/clone
 *
 * Body (all optional): same nested shape as POST /api/internal/campaigns,
 * but only the keys you want to override.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireInternalAuth,
  isInternalAuthSuccess,
} from "@/lib/security/internal-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const STRIP_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
]);

const OVERRIDE_MAP: Record<string, string> = {
  name: "name",
  status: "status",
  valueProposition: "value_prop",
  productDescription: "product_description",
  analysisPrompt: "analysis_prompt",
  emailTemplate: "email_template",
  pdfTemplate: "pdf_template",
  dailyProspectCount: "daily_prospect_count",
  gmailDraft: "gmail_draft",
};

const BRAND_OVERRIDE_MAP: Record<string, string> = {
  name: "brand_name",
  company: "brand_company",
  site: "brand_site",
  email: "brand_email",
  calendarLink: "brand_calendar_link",
  tagline: "brand_tagline",
};

const ICP_OVERRIDE_MAP: Record<string, string> = {
  description: "icp_description",
  industry: "icp_industry",
  keywords: "icp_keywords",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireInternalAuth(request);
  if (!isInternalAuthSuccess(auth)) return auth;

  const { id: sourceId } = await params;
  if (!sourceId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let overrides: Record<string, unknown> = {};
  try {
    const text = await request.text();
    overrides = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: source, error: sourceError } = await admin
    .from("campaigns")
    .select("*")
    .eq("id", sourceId)
    .eq("user_id", auth.ownerId)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const cloneRow: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!STRIP_FIELDS.has(key)) cloneRow[key] = value;
  }

  // Apply top-level overrides.
  for (const [inputKey, dbKey] of Object.entries(OVERRIDE_MAP)) {
    if (overrides[inputKey] !== undefined) {
      cloneRow[dbKey] = overrides[inputKey];
    }
  }

  // Apply brand overrides.
  if (overrides.brand && typeof overrides.brand === "object") {
    const brand = overrides.brand as Record<string, unknown>;
    for (const [inputKey, dbKey] of Object.entries(BRAND_OVERRIDE_MAP)) {
      if (brand[inputKey] !== undefined) cloneRow[dbKey] = brand[inputKey];
    }
    if (brand.colors && typeof brand.colors === "object") {
      const colors = brand.colors as Record<string, unknown>;
      if (colors.primary !== undefined) cloneRow.brand_color_primary = colors.primary;
      if (colors.dark !== undefined) cloneRow.brand_color_dark = colors.dark;
    }
  }

  // Apply ICP overrides.
  if (overrides.icp && typeof overrides.icp === "object") {
    const icp = overrides.icp as Record<string, unknown>;
    for (const [inputKey, dbKey] of Object.entries(ICP_OVERRIDE_MAP)) {
      if (icp[inputKey] !== undefined) cloneRow[dbKey] = icp[inputKey];
    }
  }

  // Default the new name if not overridden.
  if (overrides.name === undefined) {
    cloneRow.name = `${source.name} (copy)`;
  }

  const { data: created, error: insertError } = await admin
    .from("campaigns")
    .insert(cloneRow)
    .select()
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message ?? "Clone failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, sourceId, campaign: created },
    { status: 201 }
  );
}
