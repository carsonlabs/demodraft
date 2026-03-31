/**
 * DemoDraft Generic Scanner
 *
 * Replaces hardcoded product plugins with an LLM-powered analyzer.
 * Scrapes a prospect's website, then uses Claude to generate a
 * structured analysis based on the user's campaign config.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import type { ScanResult, CampaignConfig } from "./types";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

Return a JSON object matching this exact schema:
{
  "displayName": "Company Name",
  "overallScore": 0-100 (how well the product fits this prospect),
  "grade": "A" | "B" | "C" | "D" | "F",
  "subtitle": "One-line summary of the analysis",
  "categories": [
    { "id": "string", "label": "string", "score": 0-100, "checkCount": number, "passCount": number }
  ],
  "checks": [
    {
      "name": "Check name",
      "status": "pass" | "warn" | "fail",
      "details": "What we found on their site",
      "recommendation": "How our product specifically helps",
      "score": 0-100,
      "weight": 1-10,
      "category": "category-id"
    }
  ],
  "meta": {
    "keyInsight": "The single most compelling reason this prospect needs this product",
    "painPoints": ["pain1", "pain2", "pain3"],
    "opportunities": ["opp1", "opp2"]
  }
}

Generate 5-8 checks across 2-3 categories. Mix of pass/warn/fail based on what you actually see.
A "fail" check = clear opportunity where the product solves a visible problem.
A "warn" check = potential opportunity that could exist.
A "pass" check = something they're already doing well (builds credibility).

The score should reflect fit: 30-50 = great fit (lots of problems to solve), 50-70 = good fit, 70-90 = moderate fit, 90+ = they don't need much help.
IMPORTANT: Lower scores are BETTER for outreach (more pain = more reason to buy). Frame it as "readiness" or "health" so lower = worse for them but better for us.`;

/**
 * Run the generic LLM-powered scan against a prospect.
 */
export async function scanProspect(
  target: string,
  campaign: CampaignConfig
): Promise<ScanResult> {
  // 1. Scrape the website
  const scraped = await scrapeSite(target);

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

  // 3. Call Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      { role: "user", content: userPrompt },
    ],
    system: systemPrompt,
  });

  // 4. Parse the response
  const responseText =
    message.content[0]?.type === "text" ? message.content[0].text : "";

  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("LLM did not return valid JSON analysis");
  }

  const analysis = JSON.parse(jsonMatch[0]) as ScanResult;
  analysis.target = target;

  return analysis;
}

/**
 * Compose a personalized email from scan results.
 */
export function composeEmail(
  result: ScanResult,
  campaign: CampaignConfig,
  prospectEmail?: string | null
): { subject: string; body: string } {
  const meta = result.meta as Record<string, unknown> | undefined;
  const keyInsight = (meta?.keyInsight as string) ?? "some opportunities for improvement";
  const painPoints = (meta?.painPoints as string[]) ?? [];

  const topIssues = result.checks
    .filter((c) => c.status === "fail" || c.status === "warn")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  const subject = `Idea for ${result.displayName} + ${campaign.brand.company}`;

  const issuesList = topIssues
    .map((c) => `- ${c.name}: ${c.recommendation ?? c.details}`)
    .join("\n");

  const body = `Hi${prospectEmail ? "" : " there"},

I was looking at ${result.target} this morning and noticed ${keyInsight}.

I built a quick custom analysis showing exactly how ${campaign.brand.company} could help. Here are the highlights:

${issuesList}

I've attached the full report as a PDF — it covers ${result.checks.length} checks across ${result.categories.length} areas.

${campaign.brand.site ? `You can also check it out at ${campaign.brand.site}` : ""}

Let me know if you're open to a quick chat after taking a look?

Best,
${campaign.brand.name}
${campaign.brand.company}${campaign.brand.calendarLink ? `\n\nBook a time: ${campaign.brand.calendarLink}` : ""}`;

  return { subject, body };
}
