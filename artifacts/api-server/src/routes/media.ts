import { Router } from "express";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";

const router = Router();

// ── In-memory job store ──────────────────────────────────────────────────────
// Jobs are cleaned up after 15 minutes so memory doesn't grow unbounded.
type JobStatus =
  | { status: "pending" }
  | { status: "done"; logoUrl: string }
  | { status: "error"; error: string };

const jobs = new Map<string, JobStatus>();

function cleanupJob(id: string) {
  setTimeout(() => jobs.delete(id), 15 * 60 * 1000);
}

// ── Image helpers ────────────────────────────────────────────────────────────
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
      pixels[i * 4 + 3] = 0;
    } else if (r > 200 && g > 200 && b > 200) {
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

async function prepareInputImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
}

function parsePhotoBuffer(body: unknown): Buffer {
  const b = body as Record<string, unknown>;
  if (typeof b.photo !== "string" || !b.photo) throw new Error("Missing photo field");
  // Accept raw base64 or data URL (data:image/...;base64,<data>)
  const raw = b.photo.includes(",") ? b.photo.split(",")[1] : b.photo;
  return Buffer.from(raw, "base64");
}

// ── Background extraction worker ─────────────────────────────────────────────
async function runExtraction(jobId: string, fileBuffer: Buffer, businessName: string, apiKey: string) {
  logger.info({ jobId }, "logo-job: starting extraction");

  try {
    const openai = new OpenAI({ apiKey });
    const inputPng = await prepareInputImage(fileBuffer);

    const prompt =
      `This image is a photo of a flyer, letterhead, shop front, or business card for "${businessName}". ` +
      `Find the logo or brand mark in this image. ` +
      `Copy it exactly and redraw it as a clean, flat 2D vector graphic. ` +
      `Use pure white background. Preserve the original shapes, symbols, and layout of the real logo. ` +
      `No text, no shadows, no gradients, no photography, no decorative elements from the background. ` +
      `Bold, high-contrast, print-ready. Centered with padding.`;

    logger.info({ jobId }, "logo-job: calling gpt-image-1");

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
      logger.info({ jobId }, "logo-job: gpt-image-1 succeeded");

    } catch (editErr) {
      logger.warn({ jobId, editErr }, "logo-job: gpt-image-1 failed, trying dall-e-2");
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
      logger.info({ jobId }, "logo-job: dall-e-2 succeeded");
    }

    logger.info({ jobId }, "logo-job: removing white background");
    const transparentPng = await removeWhiteBackground(resultBuffer);

    let logoUrl: string;
    try {
      const safeName = businessName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
      const filename = `logos/${Date.now()}-${safeName}.png`;
      logoUrl = await uploadToGcs(transparentPng, filename);
      logger.info({ jobId, logoUrl }, "logo-job: uploaded to GCS");
    } catch {
      logger.warn({ jobId }, "logo-job: GCS not configured, using data URL");
      logoUrl = `data:image/png;base64,${transparentPng.toString("base64")}`;
    }

    jobs.set(jobId, { status: "done", logoUrl });
    logger.info({ jobId }, "logo-job: complete");

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extraction failed";
    logger.error({ jobId, err }, "logo-job: failed");
    jobs.set(jobId, { status: "error", error: msg });
  }

  cleanupJob(jobId);
}

// ── POST /media/extract-logo ─────────────────────────────────────────────────
// Accepts { photo: "<base64>", businessName: string } as JSON.
// Returns { jobId } immediately — extraction runs in background.
// Using JSON avoids multipart/form-data streaming which the dev proxy drops.
router.post("/extract-logo", (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OpenAI not configured" });

  let fileBuffer: Buffer;
  try {
    fileBuffer = parsePhotoBuffer(req.body);
  } catch {
    return res.status(400).json({ error: "No photo provided" });
  }

  const businessName = (req.body as Record<string, unknown>).businessName as string || "the business";
  const jobId = randomUUID();

  jobs.set(jobId, { status: "pending" });

  // Fire and forget — client will poll for the result
  runExtraction(jobId, fileBuffer, businessName, apiKey);

  req.log.info({ jobId }, "logo-extract: job queued");
  return res.json({ jobId });
});

// ── GET /media/extract-logo/status/:jobId ────────────────────────────────────
// Poll this every 2 seconds. Returns { status, logoUrl?, error? }.
router.get("/extract-logo/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found or expired" });
  return res.json(job);
});

export default router;
