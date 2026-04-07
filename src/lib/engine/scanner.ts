/**
 * DemoDraft Generic Scanner
 *
 * Replaces hardcoded product plugins with an LLM-powered analyzer.
 * Scrapes a prospect's website, then uses Claude to generate a
 * structured analysis based on the user's campaign config.
 */

import * as cheerio from "cheerio";
import { getAnthropicClient, MODEL } from "@/lib/anthropic";
import { scanWithCache } from "@/lib/cache";
import { retryApiCall, isRetryableError } from "@/lib/retry";
import type { ScanResult, CampaignConfig } from "./types";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

interface ScrapedSite {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  bodyText: string;
  outboundLinks: string[];
  techSignals: string[];
}

function parseSiteHtml(html: string, url: string, domain: string): ScrapedSite {
  const $ = cheerio.load(html);

  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text && headings.length < 20) headings.push(text);
  });

  $("nav, footer, script, style, noscript, iframe").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 5000);

  const outboundLinks: string[] = [];
  const baseDomain = domain.replace(/^www\./, "");
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("http") && !href.includes(baseDomain) && outboundLinks.length < 20) {
      outboundLinks.push(href);
    }
  });

  const techSignals: string[] = [];
  const htmlLower = html.toLowerCase();
  if (htmlLower.includes("shopify")) techSignals.push("Shopify");
  if (htmlLower.includes("wordpress")) techSignals.push("WordPress");
  if (htmlLower.includes("wix")) techSignals.push("Wix");
  if (htmlLower.includes("squarespace")) techSignals.push("Squarespace");
  if (htmlLower.includes("react")) techSignals.push("React");
  if (htmlLower.includes("next")) techSignals.push("Next.js");
  if (htmlLower.includes("stripe")) techSignals.push("Stripe");
  if (htmlLower.includes("intercom")) techSignals.push("Intercom");
  if (htmlLower.includes("hubspot")) techSignals.push("HubSpot");
  if (htmlLower.includes("google-analytics") || htmlLower.includes("gtag"))
    techSignals.push("Google Analytics");

  return { url, title, metaDescription, headings, bodyText, outboundLinks, techSignals };
}

/**
 * Scrape a prospect's website for LLM analysis.
 */
async function scrapeSite(domain: string): Promise<ScrapedSite> {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": BROWSER_UA },
    redirect: "follow",
  });

  if (!res.ok) {
    if (!domain.startsWith("www.")) {
      const wwwUrl = `https://www.${domain}`;
      const retry = await fetch(wwwUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": BROWSER_UA },
        redirect: "follow",
      }).catch(() => null);

      if (retry?.ok) {
        const html = await retry.text();
        return parseSiteHtml(html, wwwUrl, domain);
      }
    }
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  return parseSiteHtml(html, url, domain);
}

const DEFAULT_ANALYSIS_PROMPT = `You are a sales analyst. Given a prospect's website content and a product/service description, generate a structured analysis showing exactly how this product solves the prospect's specific problems.

Be specific — reference actual content from their website. Don't be generic.

Generate 5-8 checks across 2-3 categories. Mix of pass/warn/fail based on what you actually see.
A "fail" check = clear opportunity where the product solves a visible problem.
A "warn" check = potential opportunity that could exist.
A "pass" check = something they're already doing well (builds credibility).

The score should reflect fit: 30-50 = great fit (lots of problems to solve), 50-70 = good fit, 70-90 = moderate fit, 90+ = they don't need much help.
IMPORTANT: Lower scores are BETTER for outreach (more pain = more reason to buy). Frame it as "readiness" or "health" so lower = worse for them but better for us.

For meta.keyInsight: write the single most compelling reason this prospect needs the product.`;

/**
 * Run the generic LLM-powered scan against a prospect.
 */
export async function scanProspect(
  target: string,
  campaign: CampaignConfig
): Promise<ScanResult> {
  // 1. Scrape the website with retry logic
  const scraped = await retryApiCall(() => scrapeSite(target), {
    maxRetries: 2,
    baseDelayMs: 500,
  });

  // 2. Build the LLM prompt
  const systemPrompt = campaign.analysisPrompt || DEFAULT_ANALYSIS_PROMPT;

  const userPrompt = `## Product/Service Being Sold
**Company:** ${campaign.brand.company}
**Value Proposition:** ${campaign.valueProposition}
**Product Description:** ${campaign.productDescription}

## Prospect Website Content
**URL:** ${scraped.url}
**Title:** ${scraped.title}
**Meta Description:** ${scraped.metaDescription}
**Key Headings:** ${scraped.headings.join(" | ")}
**Tech Stack Detected:** ${scraped.techSignals.join(", ") || "None detected"}
**Content:** ${scraped.bodyText.slice(0, 3000)}

Generate the analysis JSON. Be specific to THIS prospect's actual content.`;

  // 3. Call Claude with structured outputs and caching
  const cacheKey = `scan:${target}:${campaign.id}:${systemPrompt.slice(0, 100)}`;
  
  const anthropic = getAnthropicClient();
  const analysis = await scanWithCache(cacheKey, async () => {
    const message = await retryApiCall(
      () => anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        messages: [
          { role: "user", content: userPrompt },
        ],
        system: [{ type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" as const } }],
        output_config: {
          format: {
            type: "json_schema" as const,
            schema: {
              type: "object",
              properties: {
                displayName: { type: "string" },
                overallScore: { type: "integer" },
                grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
                subtitle: { type: "string" },
                categories: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                      score: { type: "integer" },
                      checkCount: { type: "integer" },
                      passCount: { type: "integer" },
                    },
                    required: ["id", "label", "score", "checkCount", "passCount"],
                    additionalProperties: false,
                  },
                },
                checks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      status: { type: "string", enum: ["pass", "warn", "fail"] },
                      details: { type: "string" },
                      recommendation: { type: "string" },
                      score: { type: "integer" },
                      weight: { type: "integer" },
                      category: { type: "string" },
                    },
                    required: ["name", "status", "details", "recommendation", "score", "weight", "category"],
                    additionalProperties: false,
                  },
                },
                meta: {
                  type: "object",
                  properties: {
                    keyInsight: { type: "string" },
                    painPoints: { type: "array", items: { type: "string" } },
                    opportunities: { type: "array", items: { type: "string" } },
                  },
                  required: ["keyInsight", "painPoints", "opportunities"],
                  additionalProperties: false,
                },
              },
              required: ["displayName", "overallScore", "grade", "subtitle", "categories", "checks", "meta"],
              additionalProperties: false,
            },
          },
        },
      }),
      {
        maxRetries: 3,
        shouldRetry: isRetryableError,
      }
    );

    // Parse — structured outputs guarantee valid JSON in the first text block
    const responseText =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    return JSON.parse(responseText) as ScanResult;
  });
  
  analysis.target = target;

  return analysis;
}

/**
 * Email subject line variants — rotated for A/B testing.
 * The pipeline picks one based on prospect index to ensure variety.
 */
const SUBJECT_TEMPLATES = [
  (name: string, company: string) => `Idea for ${name} + ${company}`,
  (name: string, company: string) => `Quick analysis of ${name}`,
  (name: string, _company: string) => `${name} — spotted something`,
];

/**
 * Compose a personalized cold email from scan results.
 *
 * Philosophy: 3 sentences max. The PDF does the heavy lifting.
 * The email just needs to get them to open the attachment.
 */
export function composeEmail(
  result: ScanResult,
  campaign: CampaignConfig,
  prospectEmail?: string | null
): { subject: string; body: string } {
  const meta = result.meta as Record<string, unknown> | undefined;
  const keyInsight = (meta?.keyInsight as string) ?? "some opportunities for improvement";

  const topIssue = result.checks
    .filter((c) => c.status === "fail")
    .sort((a, b) => b.weight - a.weight)[0];

  // Rotate subject lines
  const subjectFn = SUBJECT_TEMPLATES[
    Math.abs(hashCode(result.target)) % SUBJECT_TEMPLATES.length
  ]!;
  const subject = subjectFn(result.displayName, campaign.brand.company);

  const specificHook = topIssue
    ? topIssue.recommendation ?? topIssue.details
    : keyInsight;

  const body = `Hi,

I was looking at ${result.target} and noticed ${keyInsight.toLowerCase()}.

I put together a quick custom report — ${specificHook.length > 80 ? specificHook.slice(0, 80) + "..." : specificHook}. Full breakdown attached as a PDF.

Worth a look?

${campaign.brand.name}
${campaign.brand.company}${campaign.brand.site ? ` · ${campaign.brand.site}` : ""}`;

  return { subject, body };
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}
