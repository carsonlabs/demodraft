/**
 * POST /api/onboard/analyze
 *
 * Takes a user's website URL, scrapes it, and uses Claude to auto-generate:
 * - Product name
 * - Value proposition
 * - ICP description
 * - Industry
 *
 * Returns pre-filled form data the user can refine before creating their campaign.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, MODEL } from "@/lib/anthropic";
import * as cheerio from "cheerio";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json();
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const domain = url.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  // Scrape the site
  let html = "";
  try {
    const fetchUrl = `https://${domain}`;
    const res = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": BROWSER_UA },
      redirect: "follow",
    });

    if (!res.ok) {
      // Try www
      const wwwRes = await fetch(`https://www.${domain}`, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": BROWSER_UA },
        redirect: "follow",
      });
      if (wwwRes.ok) html = await wwwRes.text();
      else return NextResponse.json({ error: `Could not fetch ${domain}` }, { status: 400 });
    } else {
      html = await res.text();
    }
  } catch {
    return NextResponse.json({ error: `Could not reach ${domain}` }, { status: 400 });
  }

  // Extract content
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text && headings.length < 15) headings.push(text);
  });
  $("nav, footer, script, style, noscript, iframe").remove();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);

  // Ask Claude with structured outputs — guaranteed valid JSON
  const anthropic = getAnthropicClient();

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: [
        {
          type: "text" as const,
          text: `You analyze a business website and extract key information for a sales outreach tool. Be specific and concise.`,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Analyze this website and tell me what the business sells and who their ideal customer is.

**URL:** ${domain}
**Title:** ${title}
**Meta Description:** ${metaDesc}
**Headings:** ${headings.join(" | ")}
**Content:** ${bodyText.slice(0, 2000)}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema" as const,
          schema: {
            type: "object",
            properties: {
              productName: {
                type: "string",
                description: "The company or product name",
              },
              valueProp: {
                type: "string",
                description: "One-line description of what they sell and the key benefit (max 100 chars)",
              },
              icpDescription: {
                type: "string",
                description: "2-3 sentence description of their ideal customer — who buys this, what size company, what pain they have",
              },
              icpIndustry: {
                type: "string",
                enum: [
                  "E-commerce / DTC",
                  "SaaS / Software",
                  "Agency / Consulting",
                  "Blog / Content / Media",
                  "Restaurant / Food Service",
                  "Fitness / Wellness",
                  "Real Estate",
                  "Healthcare / Medical",
                  "Finance / Accounting",
                  "Other",
                ],
              },
            },
            required: ["productName", "valueProp", "icpDescription", "icpIndustry"],
            additionalProperties: false,
          },
        },
      },
    });

    const responseText =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    const result = JSON.parse(responseText);

    return NextResponse.json({
      productName: result.productName ?? domain,
      valueProp: result.valueProp ?? "",
      icpDescription: result.icpDescription ?? "",
      icpIndustry: result.icpIndustry ?? "Other",
      website: domain,
    });
  } catch {
    // Fallback to scraped data if LLM fails
    return NextResponse.json({
      productName: title || domain,
      valueProp: metaDesc || "",
      icpDescription: "",
      icpIndustry: "Other",
      website: domain,
    });
  }
}
