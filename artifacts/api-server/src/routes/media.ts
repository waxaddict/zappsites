import { Router } from "express";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";

const router = Router();

// ── In-memory job store ──────────────────────────────────────────────────────
type JobStatus =
  | { status: "pending" }
  | { status: "done"; logoUrl: string; buffer?: Buffer }
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
    const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
    if (r > 230 && g > 230 && b > 230) {
      pixels[i * 4 + 3] = 0;
    } else if (r > 200 && g > 200 && b > 200) {
      pixels[i * 4 + 3] = Math.round(((Math.min(r, g, b) - 200) / 30) * 255);
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
  const gcsFile = storage.bucket(bucketName).file(filename);
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
      `No text, no shadows, no gradients, no photography. Bold, high-contrast, print-ready. Centered with padding.`;

    logger.info({ jobId }, "logo-job: calling gpt-image-1");

    let resultBuffer: Buffer;
    try {
      const imageFile = await toFile(inputPng, "source.png", { type: "image/png" });
      const editResponse = await openai.images.edit({ model: "gpt-image-1", image: imageFile, prompt, size: "1024x1024" });
      const b64 = editResponse.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image from gpt-image-1");
      resultBuffer = Buffer.from(b64, "base64");
      logger.info({ jobId }, "logo-job: gpt-image-1 succeeded");
    } catch (editErr) {
      logger.warn({ jobId, editErr }, "logo-job: gpt-image-1 failed, trying dall-e-2");
      const imageFile2 = await toFile(inputPng, "source.png", { type: "image/png" });
      const fb = await openai.images.edit({ model: "dall-e-2", image: imageFile2, prompt, size: "1024x1024", response_format: "b64_json", n: 1 });
      const b64fb = fb.data?.[0]?.b64_json;
      if (!b64fb) throw new Error("No image from dall-e-2");
      resultBuffer = Buffer.from(b64fb, "base64");
      logger.info({ jobId }, "logo-job: dall-e-2 succeeded");
    }

    logger.info({ jobId }, "logo-job: removing white background");
    const transparentPng = await removeWhiteBackground(resultBuffer);

    let logoUrl: string;
    try {
      const safeName = businessName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30);
      logoUrl = await uploadToGcs(transparentPng, `logos/${Date.now()}-${safeName}.png`);
      logger.info({ jobId, logoUrl }, "logo-job: uploaded to GCS");
      // GCS gives a real public URL — no need to keep buffer in memory
      jobs.set(jobId, { status: "done", logoUrl });
    } catch {
      // No GCS: store buffer in memory, serve it via /result/:jobId
      logoUrl = `/api/media/extract-logo/result/${jobId}`;
      logger.warn({ jobId }, "logo-job: GCS not configured, serving result from memory");
      jobs.set(jobId, { status: "done", logoUrl, buffer: transparentPng });
    }

    logger.info({ jobId }, "logo-job: complete");
  } catch (err) {
    logger.error({ jobId, err }, "logo-job: failed");
    jobs.set(jobId, { status: "error", error: err instanceof Error ? err.message : "Extraction failed" });
  }

  cleanupJob(jobId);
}

// ── POST /media/extract-logo ─────────────────────────────────────────────────
// Body: { photo: "<base64 or data-url>", businessName: string }
// Returns: { jobId } immediately. Heavy work runs in background.
router.post("/extract-logo", (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "OpenAI not configured" });

  let fileBuffer: Buffer;
  try { fileBuffer = parsePhotoBuffer(req.body); }
  catch { return res.status(400).json({ error: "No photo provided" }); }

  const businessName = (req.body as Record<string, unknown>).businessName as string || "the business";
  const jobId = randomUUID();

  jobs.set(jobId, { status: "pending" });
  runExtraction(jobId, fileBuffer, businessName, apiKey);

  req.log.info({ jobId }, "logo-extract: job queued");
  return res.json({ jobId });
});

// ── GET /media/extract-logo/status/:jobId ────────────────────────────────────
// Returns { status } only — never returns the image data.
// When done, logoUrl is a proper URL (GCS or /api/media/extract-logo/result/:id).
router.get("/extract-logo/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found or expired" });

  if (job.status === "done") {
    // Return URL only — never embed the image data in poll responses
    return res.json({ status: "done", logoUrl: job.logoUrl });
  }
  return res.json({ status: job.status, ...(job.status === "error" ? { error: job.error } : {}) });
});

// ── GET /media/extract-logo/result/:jobId ────────────────────────────────────
// Serves the PNG binary directly — used when GCS is not configured.
// This is what the <img src="..."> loads; the browser handles it natively.
router.get("/extract-logo/result/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "done") return res.status(404).end();

  const buf = (job as { status: "done"; logoUrl: string; buffer?: Buffer }).buffer;
  if (!buf) return res.status(404).end(); // GCS jobs don't store buffer

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=900");
  return res.send(buf);
});

export default router;
