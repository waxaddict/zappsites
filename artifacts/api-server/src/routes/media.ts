import { Router } from "express";
import multer from "multer";
import OpenAI from "openai";
import sharp from "sharp";
import { Storage } from "@google-cloud/storage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

async function removeWhiteBackground(buffer: Buffer): Promise<Buffer> {
  const img = sharp(buffer).resize(800, 800, { fit: "inside", withoutEnlargement: true });
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data.buffer);
  const total = info.width * info.height;

  for (let i = 0; i < total; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    // Make near-white pixels fully transparent
    if (r > 225 && g > 225 && b > 225) {
      pixels[i * 4 + 3] = 0;
    } else if (r > 200 && g > 200 && b > 200) {
      // Soft edge: partial transparency
      const dist = Math.min(r, g, b) - 200;
      pixels[i * 4 + 3] = Math.round((dist / 25) * 255);
    }
  }

  return sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

async function uploadToGcs(buffer: Buffer, filename: string): Promise<string> {
  const credJson = process.env.GCS_CREDENTIALS_JSON;
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!credJson || !bucketName) throw new Error("GCS not configured");

  const credentials = JSON.parse(credJson);
  const storage = new Storage({ credentials });
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filename);

  await file.save(buffer, { contentType: "image/png", public: true, resumable: false });
  return `https://storage.googleapis.com/${bucketName}/${filename}`;
}

// POST /media/extract-logo
// Accepts a photo, returns a transparent-background logo PNG URL
// businessName used to guide the AI prompt
router.post("/extract-logo", upload.single("photo"), async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OpenAI not configured" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "No photo uploaded" });

  const businessName = (req.body.businessName as string) || "this business";

  try {
    const openai = new OpenAI({ apiKey });
    const base64 = file.buffer.toString("base64");
    const mime = file.mimetype;

    // Step 1: GPT-4o Vision — identify and describe the logo
    req.log.info("logo-extract: analysing photo with GPT-4o vision");
    const vision = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${base64}`, detail: "high" },
          },
          {
            type: "text",
            text: `Examine this image — it may be a shop front, flyer, letterhead, or business card for "${businessName}".
Identify the logo or brand mark (NOT the business name text, NOT decorative photography — the actual icon, emblem, or graphic mark).
Describe ONLY the graphic/icon element: its shape, symbol, colours, and style in 30 words or fewer.
If there is no clear icon/emblem (wordmark-only brand), describe the dominant visual shape or motif present.
Return ONLY the description, nothing else.`,
          },
        ],
      }],
      max_tokens: 80,
    });

    const logoDesc = vision.choices[0]?.message?.content?.trim() || `icon for ${businessName}`;
    req.log.info({ logoDesc }, "logo-extract: vision description");

    // Step 2: DALL-E 3 — regenerate as clean vector-style icon on pure white
    const dallePrompt =
      `Minimal flat vector logo icon: ${logoDesc}. ` +
      `Pure white background, centered with padding. No text, no drop shadows, no gradients. ` +
      `Bold clean shapes, single dark colour on white. Suitable for professional business branding. ` +
      `High contrast, print-ready.`;

    req.log.info("logo-extract: generating clean logo with DALL-E 3");
    const dalleResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    const dalleUrl = dalleResponse.data?.[0]?.url;
    if (!dalleUrl) throw new Error("DALL-E returned no image");

    // Step 3: Download the generated image
    const imgFetch = await fetch(dalleUrl);
    const imgBuffer = Buffer.from(await imgFetch.arrayBuffer());

    // Step 4: Strip white background → transparent PNG
    req.log.info("logo-extract: removing white background");
    const transparentPng = await removeWhiteBackground(imgBuffer);

    // Step 5: Upload to GCS (fallback: return DALL-E URL directly if GCS not configured)
    let logoUrl: string;
    try {
      const filename = `logos/${Date.now()}-${businessName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}.png`;
      logoUrl = await uploadToGcs(transparentPng, filename);
      req.log.info({ logoUrl }, "logo-extract: uploaded to GCS");
    } catch (gcsErr) {
      req.log.warn({ gcsErr }, "logo-extract: GCS upload failed, using DALL-E URL as fallback");
      // Fallback: return the DALL-E temporary URL (valid ~1 hour)
      logoUrl = dalleUrl;
    }

    return res.json({ logoUrl, description: logoDesc });
  } catch (err) {
    req.log.error({ err }, "logo extraction error");
    return res.status(500).json({ error: "Logo extraction failed. Please try again." });
  }
});

export default router;
