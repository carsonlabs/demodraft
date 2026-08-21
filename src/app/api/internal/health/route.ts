/**
 * GET /api/internal/health
 *
 * Validates that INTERNAL_API_TOKEN + INTERNAL_OWNER_USER_ID are wired up
 * correctly and that callers can reach the internal API surface.
 *
 *   curl -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
 *        https://demodraft.app/api/internal/health
 *
 * Returns:
 *   200 { ok: true, ownerId, ts } — auth + config OK
 *   401 { error: "Unauthorized" }  — bad/missing token
 *   503 { error: "Internal API not configured" } — env vars unset
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireInternalAuth,
  isInternalAuthSuccess,
} from "@/lib/security/internal-auth";

export async function GET(request: NextRequest) {
  const auth = requireInternalAuth(request);
  if (!isInternalAuthSuccess(auth)) return auth;

  return NextResponse.json({
    ok: true,
    ownerId: auth.ownerId,
    ts: new Date().toISOString(),
  });
}
