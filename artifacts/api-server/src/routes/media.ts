import { Router } from "express";
import sharp from "sharp";
import { Storage } from "@google-cloud/storage";
import OpenAI from "openai";

const router = Router();

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
// Body: { photo: "<base64 or data-url>" }
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
// Body: { images: string[] }  — up to 4 base64 or data-URL encoded images
// Returns: { businessName, tagline, blurb, brandColors, tone, fontStyle }
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            ...imageContents,
            {
              type: "text",
              text: `You are a professional brand identity analyst. Study these marketing material image(s) carefully and extract every detail you can see.

Return ONLY a valid JSON object — no markdown, no explanation, just the JSON:

{
  "businessName": "exact business name as shown, or null if unclear",
  "tagline": "the primary tagline or slogan as written verbatim, or null",
  "blurb": "2-3 sentences that capture this business in their own brand voice — include their story, what they do, and what makes them special. Write it as website copy.",
  "brandColors": ["#hexcode1", "#hexcode2"],
  "tone": "one brief phrase describing the brand personality (e.g. bold and artisan, playful and youthful, premium and minimal)",
  "fontStyle": "brief typography description (e.g. heavy condensed sans-serif, hand-lettered script, elegant serif)"
}

Critical rules:
- brandColors: extract 2–3 most prominent colours as PRECISE hex codes. Look at backgrounds, bold text, and graphic elements. Be accurate — e.g. a specific purple should be #7B5EA7 not just #800080.
- blurb: write in first person as the business ("We..."), matching their voice exactly.
- If a field is truly not determinable, use null.`,
            },
          ],
        },
      ],
      max_tokens: 600,
    });

    const raw = response.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ raw }, "analyse-brand: no JSON in response");
      return res.status(500).json({ error: "AI could not read the materials. Try a clearer photo." });
    }

    const result = JSON.parse(jsonMatch[0]) as {
      businessName?: string | null;
      tagline?: string | null;
      blurb?: string | null;
      brandColors?: string[];
      tone?: string | null;
      fontStyle?: string | null;
    };

    req.log.info({ businessName: result.businessName, colors: result.brandColors }, "analyse-brand: done");
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "analyse-brand: failed");
    return res.status(500).json({ error: "Brand analysis failed. Please check the OpenAI API key." });
  }
});

// ── POST /media/scrape-url ────────────────────────────────────────────────────
// Body: { url: string }
// Fetches the URL, extracts OG tags + page text, runs through GPT to get structured business info.
router.post("/scrape-url", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL required" });
  }

  let normalised = url.trim();
  if (!normalised.startsWith("http")) normalised = `https://${normalised}`;

  try {
    const fetchRes = await fetch(normalised, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!fetchRes.ok) {
      return res.status(422).json({ error: `Could not reach that URL (HTTP ${fetchRes.status}).` });
    }

    const html = await fetchRes.text();

    // Extract OG / meta tags
    const og: Record<string, string> = {};
    for (const m of html.matchAll(/<meta[^>]+property=["']og:(\w+)["'][^>]+content=["']([^"']+)["']/gi)) {
      og[m[1]] = m[2];
    }
    const metaDesc =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
    const pageTitle = html
      .match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
      ?.replace(/\s*[-|].*$/, "")
      .trim() || "";

    // Strip tags and get plain text excerpt
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
      messages: [
        {
          role: "user",
          content: `Extract business information from this web page and return ONLY valid JSON.

Page title: ${pageTitle}
OG title: ${og.title || ""}
OG description: ${og.description || metaDesc}
OG image: ${og.image || ""}
Page text excerpt:
${bodyText}

Return ONLY this JSON (no markdown):
{
  "businessName": "the business name",
  "blurb": "2-3 sentences about the business in first person, in their voice",
  "services": ["up to 5 services or products they offer"],
  "ogImage": "${og.image || ""}"
}`,
        },
      ],
      max_tokens: 400,
    });

    const raw2 = result.choices[0]?.message?.content || "";
    const jsonMatch = raw2.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Could not extract content from that URL." });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      businessName?: string;
      blurb?: string;
      services?: string[];
      ogImage?: string;
    };

    // Prefer the real og:image over whatever GPT put in the JSON
    if (og.image) parsed.ogImage = og.image;

    req.log.info({ url, businessName: parsed.businessName }, "scrape-url: done");
    return res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "scrape-url: failed");
    return res.status(500).json({
      error: "Could not read that URL. Instagram and Facebook often block automated access — try the business website instead.",
    });
  }
});

export default router;
