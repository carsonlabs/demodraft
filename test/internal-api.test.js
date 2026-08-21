#!/usr/bin/env node
/**
 * Internal API contract tests.
 *
 * Exercises every /api/internal/* endpoint's input-validation and auth
 * paths against a running dev server. Doesn't require a real Supabase
 * because all asserted cases short-circuit before / at the DB lookup.
 *
 * Usage:
 *   # Start the dev server in another terminal:
 *   npm run dev
 *
 *   # Then run the tests:
 *   DEMODRAFT_TEST_BASE_URL=http://localhost:3000 \
 *   DEMODRAFT_TEST_TOKEN=<INTERNAL_API_TOKEN value> \
 *     node test/internal-api.test.js
 *
 * Defaults to http://localhost:3000 and the placeholder token from
 * .env.local so it Just Works in dev.
 */

"use strict";

const BASE = (process.env.DEMODRAFT_TEST_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const TOKEN = process.env.DEMODRAFT_TEST_TOKEN || "generate-a-long-random-string";

const FAKE_ID = "00000000-0000-0000-0000-000000000000";

// ── Tiny assertion helpers ──────────────────────────────────────────────────

function eq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function match(actual, regex, label) {
  if (!regex.test(String(actual))) {
    throw new Error(`${label}: ${JSON.stringify(actual)} did not match ${regex}`);
  }
}

async function call(method, pathName, { token = TOKEN, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  } else if (raw !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = raw;
  }
  const r = await fetch(`${BASE}${pathName}`, init);
  let parsed = null;
  const text = await r.text();
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  }
  return { status: r.status, body: parsed };
}

// ── Cases ───────────────────────────────────────────────────────────────────

const cases = [
  // Auth layer
  ["health: no auth → 401", async () => {
    const r = await call("GET", "/api/internal/health", { token: null });
    eq(r.status, 401, "status");
    eq(r.body.error, "Unauthorized", "error");
  }],
  ["health: wrong token → 401", async () => {
    const r = await call("GET", "/api/internal/health", { token: "wrong" });
    eq(r.status, 401, "status");
  }],
  ["health: malformed Authorization → 401", async () => {
    const r = await fetch(`${BASE}/api/internal/health`, {
      headers: { Authorization: "NotBearer foo" },
    });
    eq(r.status, 401, "status");
  }],
  ["health: right token → 200 with ownerId + ts", async () => {
    const r = await call("GET", "/api/internal/health");
    eq(r.status, 200, "status");
    eq(r.body.ok, true, "ok");
    if (typeof r.body.ownerId !== "string") throw new Error("ownerId missing");
    match(r.body.ts, /^\d{4}-\d{2}-\d{2}T/, "ts");
  }],

  // Bulk prospect import — validation paths
  ["prospects.import: invalid JSON → 400", async () => {
    const r = await call("POST", "/api/internal/prospects/import", { raw: "not-json" });
    eq(r.status, 400, "status");
    match(r.body.error, /Invalid JSON/i, "error");
  }],
  ["prospects.import: missing campaignId → 400", async () => {
    const r = await call("POST", "/api/internal/prospects/import", {
      body: { prospects: [{ target: "a.com" }] },
    });
    eq(r.status, 400, "status");
    match(r.body.error, /campaignId/i, "error");
  }],
  ["prospects.import: missing prospects → 400", async () => {
    const r = await call("POST", "/api/internal/prospects/import", {
      body: { campaignId: "x" },
    });
    eq(r.status, 400, "status");
    match(r.body.error, /prospects/i, "error");
  }],
  ["prospects.import: empty array → 400", async () => {
    const r = await call("POST", "/api/internal/prospects/import", {
      body: { campaignId: "x", prospects: [] },
    });
    eq(r.status, 400, "status");
  }],
  ["prospects.import: oversized array → 400", async () => {
    const r = await call("POST", "/api/internal/prospects/import", {
      body: {
        campaignId: "x",
        prospects: Array.from({ length: 501 }, (_, i) => ({ target: `${i}.example.com` })),
      },
    });
    eq(r.status, 400, "status");
    match(r.body.error, /max 500/i, "error");
  }],
  ["prospects.import: campaign not found → 404", async () => {
    const r = await call("POST", "/api/internal/prospects/import", {
      body: { campaignId: FAKE_ID, prospects: [{ target: "example.com" }] },
    });
    eq(r.status, 404, "status");
    eq(r.body.error, "Campaign not found", "error");
  }],

  // Campaign create — validation paths
  ["campaigns.create: missing name → 400", async () => {
    const r = await call("POST", "/api/internal/campaigns", {
      body: { valueProposition: "a", productDescription: "b" },
    });
    eq(r.status, 400, "status");
    match(r.body.error, /name is required/i, "error");
  }],
  ["campaigns.create: missing valueProposition → 400", async () => {
    const r = await call("POST", "/api/internal/campaigns", {
      body: { name: "x", productDescription: "b" },
    });
    eq(r.status, 400, "status");
    match(r.body.error, /valueProposition/i, "error");
  }],
  ["campaigns.create: missing productDescription → 400", async () => {
    const r = await call("POST", "/api/internal/campaigns", {
      body: { name: "x", valueProposition: "a" },
    });
    eq(r.status, 400, "status");
    match(r.body.error, /productDescription/i, "error");
  }],
  ["campaigns.create: bad pdfTemplate → 400", async () => {
    const r = await call("POST", "/api/internal/campaigns", {
      body: { name: "x", valueProposition: "a", productDescription: "b", pdfTemplate: "wacky" },
    });
    eq(r.status, 400, "status");
    match(r.body.error, /pdfTemplate/i, "error");
  }],
  ["campaigns.create: bad status → 400", async () => {
    const r = await call("POST", "/api/internal/campaigns", {
      body: { name: "x", valueProposition: "a", productDescription: "b", status: "foo" },
    });
    eq(r.status, 400, "status");
    match(r.body.error, /status/i, "error");
  }],

  // Campaign clone
  ["campaigns.clone: source not found → 404", async () => {
    const r = await call("POST", `/api/internal/campaigns/${FAKE_ID}/clone`, { body: {} });
    eq(r.status, 404, "status");
    eq(r.body.error, "Campaign not found", "error");
  }],
  ["campaigns.clone: invalid JSON body → 400", async () => {
    const r = await call("POST", `/api/internal/campaigns/${FAKE_ID}/clone`, { raw: "not-json" });
    eq(r.status, 400, "status");
  }],
  ["campaigns.clone: empty body OK (defaults applied) → 404 (source missing, not 400)", async () => {
    // No body should be tolerated — clone defaults to copying source unchanged.
    const r = await fetch(`${BASE}/api/internal/campaigns/${FAKE_ID}/clone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    // Empty request body parses as ""; clone treats that as no overrides and proceeds to lookup.
    eq(r.status, 404, "status");
  }],

  // Internal-auth on every internal route
  ["campaigns.create: no auth → 401", async () => {
    const r = await call("POST", "/api/internal/campaigns", { token: null, body: {} });
    eq(r.status, 401, "status");
  }],
  ["campaigns.clone: no auth → 401", async () => {
    const r = await call("POST", `/api/internal/campaigns/${FAKE_ID}/clone`, {
      token: null,
      body: {},
    });
    eq(r.status, 401, "status");
  }],
  ["prospects.import: no auth → 401", async () => {
    const r = await call("POST", "/api/internal/prospects/import", { token: null, body: {} });
    eq(r.status, 401, "status");
  }],
];

// ── Runner ──────────────────────────────────────────────────────────────────

async function ensureServer() {
  try {
    const r = await fetch(`${BASE}/api/internal/health`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (r.status === 503) {
      process.stderr.write(
        `Server returned 503 — INTERNAL_API_TOKEN or INTERNAL_OWNER_USER_ID not set in .env.local.\n`
      );
      process.exit(2);
    }
  } catch (err) {
    process.stderr.write(
      `Cannot reach ${BASE} — is the dev server running? (npm run dev)\n` +
        `  ${err.message}\n`
    );
    process.exit(2);
  }
}

(async () => {
  await ensureServer();
  process.stdout.write(`Running ${cases.length} tests against ${BASE}\n\n`);
  let passed = 0, failed = 0;
  const failures = [];
  for (const [name, fn] of cases) {
    try {
      await fn();
      process.stdout.write(`  ✓ ${name}\n`);
      passed++;
    } catch (err) {
      process.stdout.write(`  ✗ ${name}\n      ${err.message}\n`);
      failures.push({ name, message: err.message });
      failed++;
    }
  }
  process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
