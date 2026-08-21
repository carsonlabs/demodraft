/**
 * Internal API auth — bearer-token guard for /api/internal/* routes.
 *
 * Designed for trusted internal callers (command-center, CLIs, agents)
 * that don't have a Supabase user session. All actions taken via this
 * path are attributed to the configured owner user_id, so DB writes
 * land in the same place as the dashboard's own work.
 *
 * Env vars required:
 *   INTERNAL_API_TOKEN     — shared secret. Long random string.
 *   INTERNAL_OWNER_USER_ID — Supabase auth user UUID to attribute writes to.
 *
 * If either is unset, all internal routes return 503 (not 401) so it's
 * obvious the deploy is misconfigured rather than the caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export interface InternalAuthSuccess {
  ok: true;
  ownerId: string;
}

export type InternalAuthResult = InternalAuthSuccess | NextResponse;

export function requireInternalAuth(request: NextRequest): InternalAuthResult {
  const expected = process.env.INTERNAL_API_TOKEN;
  const ownerId = process.env.INTERNAL_OWNER_USER_ID;

  if (!expected || !ownerId) {
    return NextResponse.json(
      { error: "Internal API not configured" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const presented = Buffer.from(match[1]);
  const expectedBuf = Buffer.from(expected);

  if (
    presented.length !== expectedBuf.length ||
    !timingSafeEqual(presented, expectedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { ok: true, ownerId };
}

export function isInternalAuthSuccess(
  result: InternalAuthResult
): result is InternalAuthSuccess {
  return (result as InternalAuthSuccess).ok === true;
}
