import { Router } from "express";
import sharp from "sharp";
import { Storage } from "@google-cloud/storage";

const router = Router();

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

// POST /media/upload-logo
// Body: { photo: "<base64 or data-url>", mimeType?: string }
// Resizes to max 800px, converts to PNG, uploads to GCS.
// Falls back to data URL if GCS is not configured.
router.post("/upload-logo", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (typeof body.photo !== "string" || !body.photo) {
    return res.status(400).json({ error: "No photo provided" });
  }

  const raw = body.photo.includes(",") ? body.photo.split(",")[1] : body.photo;
  const inputBuffer = Buffer.from(raw, "base64");

  try {
    // Convert to PNG, max 800px — logos are small so this is fast
    const pngBuffer = await sharp(inputBuffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    const filename = `logos/${Date.now()}.png`;

    let logoUrl: string;
    try {
      logoUrl = await uploadToGcs(pngBuffer, filename, "image/png");
      req.log.info({ logoUrl }, "logo-upload: uploaded to GCS");
    } catch (gcsErr) {
      req.log.warn({ gcsErr }, "logo-upload: GCS not configured, returning data URL");
      logoUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    }

    return res.json({ logoUrl });
  } catch (err) {
    req.log.error({ err }, "logo-upload: processing failed");
    return res.status(500).json({ error: "Could not process image. Please try a PNG or JPG file." });
  }
});

export default router;
