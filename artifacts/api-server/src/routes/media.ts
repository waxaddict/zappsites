import { Router } from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { Storage } from "@google-cloud/storage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// Strip near-white pixels → transparent PNG
async function removeWhiteBackground(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer);
  const total = info.width * info.height;

  for (let i = 0; i < total; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    if (r > 230 && g > 230 && b > 230) {
      pixels[i * 4 + 3] = 0; // fully transparent
    } else if (r > 200 && g > 200 && b > 200) {
      // soft anti-aliased edges
      const whiteness = (Math.min(r, g, b) - 200) / 30;
      pixels[i * 4 + 3] = Math.round(whiteness * 255);
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
  const gcsFile = bucket.file(filename);

  await gcsFile.save(buffer, { contentType: "image/png", public: true, resumable: false });
  return `https://storage.googleapis.com/${bucketName}/${filename}`;
}

// Prepare photo as a square RGBA PNG for the image edit API
async function prepareInputImage(buffer: Buffer, mime: string): Promise<Buffer> {
  return sharp(buffer)
    .resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
}

// POST /media/extract-logo
// Sends the ACTUAL photo to OpenAI image editing — copies and flattens the real logo.
// No description step — the model sees and reproduces the genuine logo directly.
router.post("/extract-logo", upload.single("photo"), async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OpenAI not configured" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "No photo uploaded" });

  const businessName = (req.body.businessName as string) || "the business";

  try {
    const openai = new OpenAI({ apiKey });

    // Prepare a clean PNG for the API
    req.log.info("logo-extract: preparing input image");
    const inputPng = await prepareInputImage(file.buffer, file.mimetype);

    const prompt =
      `This image is a photo of a flyer, letterhead, shop front, or business card for "${businessName}". ` +
      `Find the logo or brand mark in this image. ` +
      `Copy it exactly and redraw it as a clean, flat 2D vector graphic. ` +
      `Use pure white background. Preserve the original shapes, symbols, and layout of the real logo. ` +
      `No text, no shadows, no gradients, no photography, no decorative elements from the background. ` +
      `Bold, high-contrast, print-ready. Centered with padding.`;

    req.log.info("logo-extract: sending to gpt-image-1 editor (image-to-image)");

    // Use gpt-image-1 which can see the actual image and faithfully copy the logo
    let resultBuffer: Buffer;

    try {
      const imageFile = await toFile(inputPng, "source.png", { type: "image/png" });

      const editResponse = await openai.images.edit({
        model: "gpt-image-1",
        image: imageFile,
        prompt,
        size: "1024x1024",
      });

      const b64 = editResponse.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned from gpt-image-1");
      resultBuffer = Buffer.from(b64, "base64");
      req.log.info("logo-extract: gpt-image-1 succeeded");

    } catch (editErr) {
      // Fallback: dall-e-2 edit mode (also image-to-image, less capable but available)
      req.log.warn({ editErr }, "logo-extract: gpt-image-1 failed, trying dall-e-2 edit");

      const imageFile2 = await toFile(inputPng, "source.png", { type: "image/png" });

      const fallbackResponse = await openai.images.edit({
        model: "dall-e-2",
        image: imageFile2,
        prompt,
        size: "1024x1024",
        response_format: "b64_json",
        n: 1,
      });

      const b64Fallback = fallbackResponse.data?.[0]?.b64_json;
      if (!b64Fallback) throw new Error("No image returned from dall-e-2");
      resultBuffer = Buffer.from(b64Fallback, "base64");
      req.log.info("logo-extract: dall-e-2 fallback succeeded");
    }

    // Strip white background → transparent PNG
    req.log.info("logo-extract: removing white background");
    const transparentPng = await removeWhiteBackground(resultBuffer);

    // Upload to GCS
    let logoUrl: string;
    try {
      const safeName = businessName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
      const filename = `logos/${Date.now()}-${safeName}.png`;
      logoUrl = await uploadToGcs(transparentPng, filename);
      req.log.info({ logoUrl }, "logo-extract: uploaded to GCS");
    } catch (gcsErr) {
      // GCS not yet configured — return as data URL so it still works
      req.log.warn({ gcsErr }, "logo-extract: GCS not configured, returning data URL");
      const dataUrl = `data:image/png;base64,${transparentPng.toString("base64")}`;
      return res.json({ logoUrl: dataUrl });
    }

    return res.json({ logoUrl });
  } catch (err) {
    req.log.error({ err }, "logo extraction error");
    return res.status(500).json({ error: "Logo extraction failed. Please try again or paste a URL instead." });
  }
});

export default router;
