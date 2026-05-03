import { Router } from "express";
import sharp from "sharp";
import { Storage } from "@google-cloud/storage";
import OpenAI from "openai";

const router = Router();

// ── Font pair definitions (must match frontend) ───────────────────────────────
const FONT_PAIR_IDS = ["editorial", "bold", "luxury", "modern", "classic", "artisan"] as const;
const FONT_PAIR_DESCRIPTORS: Record<string, string> = {
  editorial: "elegant editorial serif — timeless, literary, sophisticated (Fraunces + DM Sans)",
  bold: "heavy condensed industrial — punchy, strong, high-impact (Anton + Inter)",
  luxury: "luxury minimal — refined, sparse, high-end (Cormorant + DM Sans)",
  modern: "modern clean — friendly, geometric, contemporary (Plus Jakarta Sans)",
  classic: "classic elegant serif — trusted, warm, traditional (Playfair Display + Lato)",
  artisan: "artisan handcrafted — personal, warm, craft-forward (Caveat + Inter)",
};

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function uploadToGcs(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const credJson = process.env.GCS_CREDENTIALS_JSON;
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!credJson || !bucketName) throw new Error("GCS not configured");
  const credentials = JSON.parse(credJson);
  const storage = new Storage({ credentials });
  const file = storage.bucket(bucketName).file(filename);
  await file.save(buffer, { contentType, public: true, resumable: false });
  return `https://storage.googleapis.com/${bucketName}/${filename}`;
}

// ── POST /media/upload-logo ───────────────────────────────────────────────────
router.post("/upload-logo", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (typeof body.photo !== "string" || !body.photo) {
    return res.status(400).json({ error: "No photo provided" });
  }
  const raw = body.photo.includes(",") ? body.photo.split(",")[1] : body.photo;
  const inputBuffer = Buffer.from(raw, "base64");
  try {
    const pngBuffer = await sharp(inputBuffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const filename = `logos/${Date.now()}.png`;
    let logoUrl: string;
    try {
      logoUrl = await uploadToGcs(pngBuffer, filename, "image/png");
    } catch {
      logoUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    }
    return res.json({ logoUrl });
  } catch (err) {
    req.log.error({ err }, "logo-upload: failed");
    return res.status(500).json({ error: "Could not process image. Please try a PNG or JPG file." });
  }
});

// ── POST /media/analyse-brand ─────────────────────────────────────────────────
// Body: { images: string[] }  — up to 4 base64 or data-URL images
// Returns brand identity including fontPairId suggestion
router.post("/analyse-brand", async (req, res) => {
  const { images } = req.body as { images?: string[] };
  if (!images || images.length === 0) {
    return res.status(400).json({ error: "No images provided" });
  }
  try {
    const openai = getOpenAI();

    const imageContents: OpenAI.Chat.ChatCompletionContentPart[] = images
      .slice(0, 4)
      .map(img => ({
        type: "image_url" as const,
        image_url: {
          url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
          detail: "high" as const,
        },
      }));

    const fontPairList = FONT_PAIR_IDS.map(id => `  "${id}": ${FONT_PAIR_DESCRIPTORS[id]}`).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          ...imageContents,
          {
            type: "text",
            text: `You are a professional brand identity analyst. Study these marketing material image(s) carefully.

Return ONLY a valid JSON object — no markdown, no explanation:

{
  "businessName": "exact business name as shown, or null",
  "tagline": "primary tagline or slogan verbatim, or null",
  "blurb": "2-3 sentences of website copy in first person (We...) matching the brand voice — include story, what they do, what makes them special",
  "brandColors": ["#hexcode1", "#hexcode2", "#hexcode3", "#hexcode4"],
  "fontPairId": "one of the IDs below",
  "tone": "one brief phrase describing brand personality",
  "fontStyle": "brief typography description"
}

Critical rules:
- brandColors: return 3–5 most prominent colours as PRECISE hex codes. Include the dominant background, text, accent, and any distinct logo colours. Be accurate and do not collapse similar-but-distinct shades.
- fontPairId: choose ONE of these that best matches the brand's typography and personality:
${fontPairList}
- blurb: write as the business ("We began on a kitchen table..."), capturing their actual voice.
- If a field is truly not determinable, use null.`,
          },
        ],
      }],
      max_tokens: 700,
    });

    const raw = response.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "AI could not read the materials. Try a clearer photo." });
    }
    const result = JSON.parse(jsonMatch[0]);
    req.log.info({ businessName: result.businessName, fontPairId: result.fontPairId, brandColors: result.brandColors }, "analyse-brand: done");
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "analyse-brand: failed");
    return res.status(500).json({ error: "Brand analysis failed. Please check the OpenAI API key." });
  }
});

// ── POST /media/scrape-url ────────────────────────────────────────────────────
// Body: { url: string }
// Fetches page or Instagram profile, runs through GPT for structured business info.
router.post("/scrape-url", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: "URL required" });

  let normalised = url.trim();
  if (!normalised.startsWith("http")) normalised = `https://${normalised}`;

  // ── Instagram-specific path ─────────────────────────────────────────────────
  const igMatch = normalised.match(/instagram\.com\/([A-Za-z0-9._]+)\/?/);
  if (igMatch) {
    const username = igMatch[1].replace(/^@/, "");
    try {
      // Try Instagram's internal web API (widely known app ID, no auth required for public profiles)
      const igRes = await fetch(
        `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram/303.0.0.11.109",
            "x-ig-app-id": "936619743392459",
            "Accept": "application/json",
            "Accept-Language": "en-GB,en;q=0.9",
            "Referer": "https://www.instagram.com/",
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (igRes.ok) {
        const data = await igRes.json() as {
          data?: {
            user?: {
              full_name?: string;
              biography?: string;
              profile_pic_url_hd?: string;
              edge_owner_to_timeline_media?: { edges?: Array<{ node?: { display_url?: string } }> };
            };
          };
        };
        const user = data?.data?.user;
        if (user?.biography || user?.full_name) {
          const openai = getOpenAI();
          const structured = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
              role: "user",
              content: `Instagram profile data:
Name: ${user.full_name || ""}
Bio: ${user.biography || ""}

Return ONLY JSON (no markdown):
{
  "businessName": "${user.full_name || ""}",
  "blurb": "2-3 sentences in first person from the bio",
  "services": ["up to 5 products or services mentioned"]
}`,
            }],
            max_tokens: 300,
          });
          const raw = structured.choices[0]?.message?.content || "";
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) as { businessName?: string; blurb?: string; services?: string[] } : {};
          const postImages = user.edge_owner_to_timeline_media?.edges
            ?.slice(0, 4)
            .map(e => e?.node?.display_url)
            .filter(Boolean) || [];
          return res.json({ ...parsed, ogImage: user.profile_pic_url_hd, postImages });
        }
      }
    } catch (igErr) {
      req.log.warn({ igErr }, "scrape-url: Instagram API failed, falling back");
    }

    // Fallback: fetch the HTML page
    try {
      const htmlRes = await fetch(`https://www.instagram.com/${username}/`, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Accept": "text/html",
          "Accept-Language": "en-GB",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const desc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] || "";
        const name = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]?.replace(/\s*\(@[^)]+\)/, "") || "";
        if (desc || name) {
          return res.json({ businessName: name, blurb: desc });
        }
      }
    } catch {
      // both methods failed
    }
    return res.status(422).json({ error: "Instagram is blocking automated access. Copy and paste the bio text into the description field manually." });
  }

  // ── Facebook-specific path ──────────────────────────────────────────────────
  const fbMatch = normalised.match(/facebook\.com\/([A-Za-z0-9.]+)\/?/);
  if (fbMatch) {
    try {
      const fbRes = await fetch(`https://m.facebook.com/${fbMatch[1]}/`, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(7000),
      });
      if (fbRes.ok) {
        const html = await fbRes.text();
        const desc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] || "";
        const name = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] || "";
        if (desc || name) {
          return res.json({ businessName: name, blurb: desc });
        }
      }
    } catch {
      // continue
    }
    return res.status(422).json({ error: "Facebook is blocking automated access. Copy and paste the page description manually." });
  }

  // ── General website ─────────────────────────────────────────────────────────
  try {
    const fetchRes = await fetch(normalised, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!fetchRes.ok) {
      return res.status(422).json({ error: `Could not reach that URL (HTTP ${fetchRes.status}).` });
    }

    const html = await fetchRes.text();
    const og: Record<string, string> = {};
    for (const m of html.matchAll(/<meta[^>]+property=["']og:(\w+)["'][^>]+content=["']([^"']+)["']/gi)) {
      og[m[1]] = m[2];
    }
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
    const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*[-|].*$/, "").trim() || "";

    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3500);

    const openai = getOpenAI();
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Extract business info from this web page. Return ONLY valid JSON:

Title: ${pageTitle}
OG description: ${og.description || metaDesc}
Page text: ${bodyText}

{
  "businessName": "business name",
  "blurb": "2-3 sentences in first person in their voice",
  "services": ["up to 5 services/products"]
}`,
      }],
      max_tokens: 400,
    });

    const raw2 = result.choices[0]?.message?.content || "";
    const jsonMatch = raw2.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "Could not extract content from that URL." });

    const parsed = JSON.parse(jsonMatch[0]) as { businessName?: string; blurb?: string; services?: string[]; ogImage?: string };
    if (og.image) parsed.ogImage = og.image;
    req.log.info({ url: normalised, businessName: parsed.businessName }, "scrape-url: done");
    return res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "scrape-url: failed");
    return res.status(500).json({ error: "Could not reach that URL. Try pasting the text manually." });
  }
});

export default router;
