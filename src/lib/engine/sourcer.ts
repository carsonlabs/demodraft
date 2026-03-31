/**
 * Prospect Sourcer — Auto-discover leads based on ICP
 *
 * Takes a campaign's ICP description + industry + keywords and finds
 * matching prospect websites. Uses Google Custom Search API when available,
 * falls back to curated industry lists.
 */

// ── Curated industry prospect lists ─────────────────────────────────────────
// Used as fallback when no Google Search API key is configured.

const INDUSTRY_PROSPECTS: Record<string, string[]> = {
  ecommerce: [
    "fashionnova.com", "princesspolly.com", "shopcider.com", "aloyoga.com",
    "vuoriclothing.com", "everlane.com", "kotn.com", "outdoorvoices.com",
    "fabletics.com", "rhone.com", "glossier.com", "summerfridays.com",
    "kyliecosmetics.com", "fentybeauty.com", "herbivorebotanicals.com",
    "olaplex.com", "ilia.com", "mudwtr.com", "magicspoon.com",
    "drinkpoppi.com", "ghia.com", "partakefoods.com", "burrow.com",
    "casper.com", "parachutehome.com", "caraway.com", "materialkitchen.com",
    "athleticgreens.com", "ritual.com", "seedhealth.com", "hims.com",
    "peakdesign.com", "eightsleep.com", "whoop.com",
  ],
  saas: [
    "linear.app", "notion.so", "vercel.com", "supabase.com", "resend.com",
    "cal.com", "dub.co", "tally.so", "typefully.com", "beehiiv.com",
    "lemonsqueezy.com", "gumroad.com", "paddle.com", "baremetrics.com",
    "crisp.chat", "intercom.com", "chatwoot.com", "posthog.com",
    "plausible.io", "fathom.com", "usefathom.com", "hotjar.com",
    "loom.com", "pitch.com", "miro.com", "figma.com",
  ],
  agency: [
    "webflow.com", "squarespace.com", "wix.com", "framer.com",
    "designjoy.co", "focuslab.agency", "pentagram.com", "hugeinc.com",
    "basicagency.com", "instrument.com", "metalab.com", "ueno.co",
    "fantasy.co", "locomotive.ca", "active-theory.com",
  ],
  blog: [
    "pinchofyum.com", "minimalistbaker.com", "cookieandkate.com",
    "loveandlemons.com", "halfbakedharvest.com", "skinnytaste.com",
    "nomadicmatt.com", "theblondeabroad.com", "adventurouskate.com",
    "nerdwallet.com", "thepointsguy.com", "makingsenseofcents.com",
    "smartpassiveincome.com", "abeautifulmess.com", "iamafoodblog.com",
    "runeatrepeat.com", "chasingfoxes.com", "thefrugalgirl.com",
    "digital-photography-school.com", "petapixel.com",
  ],
  restaurant: [
    "sweetgreen.com", "chipotle.com", "shakeshack.com", "cava.com",
    "blfresco.com", "noodles.com", "panerabread.com", "raising-canes.com",
    "wingstop.com", "jollibeefoods.com", "dominos.com", "papajohns.com",
  ],
  fitness: [
    "crossfit.com", "f45training.com", "orangetheory.com", "barrys.com",
    "soulcycle.com", "peloton.com", "mindbodyonline.com", "wodify.com",
    "trainerize.com", "gymshark.com", "myfitnesspal.com",
  ],
  realestate: [
    "compass.com", "redfin.com", "opendoor.com", "offerpad.com",
    "realtor.com", "trulia.com", "apartments.com", "costar.com",
    "buildium.com", "appfolio.com", "rentmanager.com",
  ],
  healthcare: [
    "zocdoc.com", "healthgrades.com", "practo.com", "doctolib.com",
    "athenahealth.com", "kareo.com", "simplepractice.com",
    "therapynotes.com", "jane.app", "cliniko.com",
  ],
  finance: [
    "brex.com", "ramp.com", "mercury.com", "relay.com", "gusto.com",
    "rippling.com", "deel.com", "wise.com", "payoneer.com",
    "freshbooks.com", "waveapps.com", "bench.co",
  ],
  consulting: [
    "mckinsey.com", "bain.com", "bcg.com", "deloitte.com",
    "accenture.com", "slalom.com", "thoughtworks.com", "capgemini.com",
    "infosys.com", "wipro.com", "cognizant.com",
  ],
};

// Map common ICP keywords to industry lists
function matchIndustry(icpDescription: string, industry: string): string[] {
  const text = `${icpDescription} ${industry}`.toLowerCase();

  const matches: string[] = [];

  if (text.match(/e-?commerce|shopify|dtc|online store|retail/)) matches.push("ecommerce");
  if (text.match(/saas|software|startup|tech company|app/)) matches.push("saas");
  if (text.match(/agency|design|web design|marketing agency|creative/)) matches.push("agency");
  if (text.match(/blog|content|affiliate|publisher|media/)) matches.push("blog");
  if (text.match(/restaurant|food service|cafe|dining|catering/)) matches.push("restaurant");
  if (text.match(/fitness|gym|health club|wellness|personal train/)) matches.push("fitness");
  if (text.match(/real estate|property|realtor|broker|rental/)) matches.push("realestate");
  if (text.match(/healthcare|medical|clinic|doctor|dental|therapy/)) matches.push("healthcare");
  if (text.match(/financ|accounting|bookkeep|tax|banking|fintech/)) matches.push("finance");
  if (text.match(/consult|advisory|professional service/)) matches.push("consulting");

  // Default to saas + ecommerce if nothing matches
  if (matches.length === 0) matches.push("saas", "ecommerce");

  return matches;
}

/**
 * Search Google Custom Search API for prospects matching the ICP.
 */
async function searchGoogle(query: string, count: number): Promise<string[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) return [];

  try {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}&num=${Math.min(count, 10)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];

    const data = (await res.json()) as { items?: { link: string }[] };
    return (data.items ?? [])
      .map((item) => {
        try {
          return new URL(item.link).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      })
      .filter((d): d is string => d !== null);
  } catch {
    return [];
  }
}

export interface SourcerConfig {
  icpDescription: string;
  icpIndustry: string;
  icpKeywords?: string;
  count?: number;
  alreadyScanned?: Set<string>;
}

/**
 * Find fresh prospect URLs based on ICP configuration.
 * Returns up to `count` unique domains.
 */
export async function sourceProspects(config: SourcerConfig): Promise<string[]> {
  const {
    icpDescription,
    icpIndustry,
    icpKeywords,
    count = 10,
    alreadyScanned = new Set(),
  } = config;

  const seen = new Set([...alreadyScanned].map((s) => s.toLowerCase()));
  const found: string[] = [];

  // 1. Try Google Custom Search if keywords provided
  if (icpKeywords) {
    const queries = icpKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    for (const query of queries) {
      if (found.length >= count) break;
      const results = await searchGoogle(query, count - found.length);
      for (const domain of results) {
        if (!seen.has(domain.toLowerCase())) {
          found.push(domain);
          seen.add(domain.toLowerCase());
        }
      }
    }
  }

  // 2. Try Google with auto-generated query from ICP
  if (found.length < count) {
    const autoQuery = `${icpDescription} ${icpIndustry} companies websites`;
    const results = await searchGoogle(autoQuery, count - found.length);
    for (const domain of results) {
      if (!seen.has(domain.toLowerCase())) {
        found.push(domain);
        seen.add(domain.toLowerCase());
      }
    }
  }

  // 3. Fill from curated industry lists
  if (found.length < count) {
    const industries = matchIndustry(icpDescription, icpIndustry);
    const allProspects: string[] = [];
    for (const ind of industries) {
      allProspects.push(...(INDUSTRY_PROSPECTS[ind] ?? []));
    }

    // Shuffle for variety
    const shuffled = allProspects.sort(() => Math.random() - 0.5);
    for (const domain of shuffled) {
      if (found.length >= count) break;
      if (!seen.has(domain.toLowerCase())) {
        found.push(domain);
        seen.add(domain.toLowerCase());
      }
    }
  }

  return found;
}
