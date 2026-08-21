#!/usr/bin/env node
/**
 * demodraft — internal CLI for the DemoDraft engine.
 *
 * Wraps /api/internal/* over HTTP so you can drive campaigns, imports, and
 * health checks from a terminal or a script. Designed for the "I just
 * launched a new product, spin up an outreach campaign and queue 100
 * prospects" workflow.
 *
 * Setup:
 *   export DEMODRAFT_BASE_URL=https://demodraft.app   # or http://localhost:3000
 *   export DEMODRAFT_INTERNAL_TOKEN=<INTERNAL_API_TOKEN value>
 *
 * Commands:
 *   demodraft health
 *   demodraft campaign create <file.json>
 *   demodraft campaign clone <id> [overrides.json]
 *   demodraft prospects import <campaignId> <file.json>
 *
 * File formats:
 *   campaign create  — single object, see /api/internal/campaigns/route.ts
 *   campaign clone   — partial overrides object (or omit for default copy)
 *   prospects import — array of {target, contactEmail?, contactName?}
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const BASE_URL = (process.env.DEMODRAFT_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const TOKEN = process.env.DEMODRAFT_INTERNAL_TOKEN;

function die(msg, code = 1) {
  process.stderr.write(`demodraft: ${msg}\n`);
  process.exit(code);
}

function ensureToken() {
  if (!TOKEN) {
    die(
      "DEMODRAFT_INTERNAL_TOKEN is not set. Export it before running:\n" +
        "  export DEMODRAFT_INTERNAL_TOKEN=<your INTERNAL_API_TOKEN value>"
    );
  }
}

function readJsonFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) die(`File not found: ${resolved}`);
  let raw;
  try {
    raw = fs.readFileSync(resolved, "utf-8");
  } catch (err) {
    die(`Cannot read ${resolved}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    die(`Invalid JSON in ${resolved}: ${err.message}`);
  }
}

async function apiCall(method, pathName, body) {
  ensureToken();
  const url = `${BASE_URL}${pathName}`;
  const init = {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    die(`Network error hitting ${url}: ${err.message}`);
  }

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    process.stderr.write(`demodraft: HTTP ${response.status} ${response.statusText}\n`);
    if (parsed) process.stderr.write(JSON.stringify(parsed, null, 2) + "\n");
    process.exit(1);
  }

  return parsed;
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

const COMMANDS = {
  health: async () => {
    const result = await apiCall("GET", "/api/internal/health");
    printJson(result);
  },

  campaign: async (sub, ...rest) => {
    if (sub === "create") {
      const file = rest[0];
      if (!file) die("Usage: demodraft campaign create <file.json>");
      const body = readJsonFile(file);
      const result = await apiCall("POST", "/api/internal/campaigns", body);
      printJson(result);
      return;
    }
    if (sub === "clone") {
      const id = rest[0];
      const file = rest[1];
      if (!id) die("Usage: demodraft campaign clone <id> [overrides.json]");
      const body = file ? readJsonFile(file) : {};
      const result = await apiCall(
        "POST",
        `/api/internal/campaigns/${encodeURIComponent(id)}/clone`,
        body
      );
      printJson(result);
      return;
    }
    die(`Unknown campaign subcommand: ${sub}. Try: create, clone`);
  },

  prospects: async (sub, ...rest) => {
    if (sub === "import") {
      const campaignId = rest[0];
      const file = rest[1];
      if (!campaignId || !file) {
        die("Usage: demodraft prospects import <campaignId> <file.json>");
      }
      const prospects = readJsonFile(file);
      if (!Array.isArray(prospects)) {
        die(`Expected ${file} to be a JSON array of {target, contactEmail?, contactName?}`);
      }
      const result = await apiCall("POST", "/api/internal/prospects/import", {
        campaignId,
        prospects,
      });
      printJson(result);
      return;
    }
    die(`Unknown prospects subcommand: ${sub}. Try: import`);
  },
};

function printUsage() {
  process.stdout.write(
    [
      "demodraft — internal CLI",
      "",
      "Usage:",
      "  demodraft health",
      "  demodraft campaign create <file.json>",
      "  demodraft campaign clone <id> [overrides.json]",
      "  demodraft prospects import <campaignId> <file.json>",
      "",
      "Env:",
      "  DEMODRAFT_BASE_URL        default: http://localhost:3000",
      "  DEMODRAFT_INTERNAL_TOKEN  required",
      "",
    ].join("\n")
  );
}

async function main() {
  const [, , command, ...rest] = process.argv;
  if (!command || command === "-h" || command === "--help") {
    printUsage();
    process.exit(command ? 0 : 1);
  }
  const handler = COMMANDS[command];
  if (!handler) die(`Unknown command: ${command}. Run 'demodraft' for usage.`);
  await handler(...rest);
}

main().catch((err) => die(err.stack || String(err)));
