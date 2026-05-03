import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, sitesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateSiteBody, UpdateSiteBody } from "@workspace/api-zod";
import { THEMES } from "../lib/themes.js";
import OpenAI from "openai";

const router = Router();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let existing = await db.select({ id: sitesTable.id }).from(sitesTable).where(eq(sitesTable.slug, candidate));
  if (existing.length === 0) return candidate;
  const suffix = Math.floor(100 + Math.random() * 900).toString();
  candidate = `${base}-${suffix}`;
  existing = await db.select({ id: sitesTable.id }).from(sitesTable).where(eq(sitesTable.slug, candidate));
  if (existing.length === 0) return candidate;
  return `${base}-${Date.now()}`;
}

function siteToResponse(site: typeof sitesTable.$inferSelect) {
  const { passwordHash, ...rest } = site;
  return {
    ...rest,
    openingHours: (rest.openingHours as string[]) || [],
    photos: (rest.photos as string[]) || [],
    brandColors: (rest.brandColors as string[]) || [],
    socialLinks: (rest.socialLinks as Record<string, string>) || {},
    demoExpiresAt: rest.demoExpiresAt?.toISOString(),
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  };
}

// GET /sites - list all
router.get("/", async (req, res) => {
  try {
    const sites = await db.select().from(sitesTable).orderBy(sitesTable.createdAt);
    return res.json({ sites: sites.map(siteToResponse) });
  } catch (err) {
    req.log.error({ err }, "list sites error");
    return res.status(500).json({ error: "Failed to list sites" });
  }
});

// POST /sites - create
router.post("/", async (req, res) => {
  const parsed = CreateSiteBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }
  const { password, businessName, ...data } = parsed.data;

  try {
    const baseSlug = slugify(businessName);
    const slug = await uniqueSlug(baseSlug);
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const demoExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [site] = await db.insert(sitesTable).values({
      slug,
      businessName,
      passwordHash,
      demoExpiresAt,
      tier: "demo",
      themeId: data.themeId || "luminary",
      placeId: data.placeId,
      address: data.address,
      postcode: data.postcode,
      phone: data.phone,
      email: data.email,
      website: data.website,
      blurb: data.blurb,
      openingHours: data.openingHours || [],
      brandColors: data.brandColors || [],
      socialLinks: data.socialLinks || {},
      lat: data.lat,
      lng: data.lng,
    }).returning();

    return res.status(201).json(siteToResponse(site));
  } catch (err) {
    req.log.error({ err }, "create site error");
    return res.status(500).json({ error: "Failed to create site" });
  }
});

// GET /sites/:slug
router.get("/:slug", async (req, res) => {
  try {
    const [site] = await db.select().from(sitesTable).where(eq(sitesTable.slug, req.params.slug));
    if (!site) return res.status(404).json({ error: "Site not found" });
    return res.json(siteToResponse(site));
  } catch (err) {
    req.log.error({ err }, "get site error");
    return res.status(500).json({ error: "Failed to get site" });
  }
});

// PUT /sites/:slug
router.put("/:slug", async (req, res) => {
  const parsed = UpdateSiteBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }
  const { password, ...updates } = parsed.data;

  try {
    const values: Partial<typeof sitesTable.$inferInsert> = {
      ...updates,
      openingHours: updates.openingHours as string[],
      photos: updates.photos as string[],
      brandColors: updates.brandColors as string[],
      socialLinks: updates.socialLinks as Record<string, string>,
      updatedAt: new Date(),
    };

    if (password) {
      values.passwordHash = await bcrypt.hash(password, 10);
    }

    const [site] = await db.update(sitesTable)
      .set(values)
      .where(eq(sitesTable.slug, req.params.slug))
      .returning();

    if (!site) return res.status(404).json({ error: "Site not found" });
    return res.json(siteToResponse(site));
  } catch (err) {
    req.log.error({ err }, "update site error");
    return res.status(500).json({ error: "Failed to update site" });
  }
});

// DELETE /sites/:slug
router.delete("/:slug", async (req, res) => {
  try {
    await db.delete(sitesTable).where(eq(sitesTable.slug, req.params.slug));
    return res.json({ message: "Site deleted" });
  } catch (err) {
    req.log.error({ err }, "delete site error");
    return res.status(500).json({ error: "Failed to delete site" });
  }
});

// GET /sites/:slug/public
router.get("/:slug/public", async (req, res) => {
  try {
    const [site] = await db.select().from(sitesTable).where(eq(sitesTable.slug, req.params.slug));
    if (!site) return res.status(404).json({ error: "Site not found" });

    const isActive = site.isActive &&
      (site.tier !== "demo" || !site.demoExpiresAt || site.demoExpiresAt > new Date());

    return res.json({
      slug: site.slug,
      businessName: site.businessName,
      themeId: site.themeId,
      tier: site.tier,
      address: site.address,
      postcode: site.postcode,
      phone: site.phone,
      email: site.email,
      blurb: site.blurb,
      aiBlurb: site.aiBlurb,
      openingHours: (site.openingHours as string[]) || [],
      logoUrl: site.logoUrl,
      photos: (site.photos as string[]) || [],
      brandColors: (site.brandColors as string[]) || [],
      socialLinks: (site.socialLinks as Record<string, string>) || {},
      headCode: site.headCode,
      lat: site.lat,
      lng: site.lng,
      isActive,
    });
  } catch (err) {
    req.log.error({ err }, "get public site error");
    return res.status(500).json({ error: "Failed to get site" });
  }
});

// POST /sites/:slug/generate - AI content generation
router.post("/:slug/generate", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "OpenAI API not configured" });
  }

  try {
    const [site] = await db.select().from(sitesTable).where(eq(sitesTable.slug, req.params.slug));
    if (!site) return res.status(404).json({ error: "Site not found" });

    const theme = THEMES.find((t) => t.id === site.themeId);

    const openai = new OpenAI({ apiKey });
    const prompt = `
You are a professional copywriter creating website content for a local business.

Business: ${site.businessName}
Address: ${site.address || ""}
Phone: ${site.phone || ""}
Raw blurb from owner: ${site.blurb || "No description provided."}
Theme style: ${theme?.style || "modern"}

Write a polished, engaging website bio for this business in 2-3 short paragraphs. 
- Make it warm, professional and authentic
- Highlight what makes them special
- Keep it under 200 words
- Do not include contact details or addresses
- Return ONLY the bio text, no labels or headers
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });

    const aiBlurb = completion.choices[0]?.message?.content?.trim() || "";

    const [updated] = await db.update(sitesTable)
      .set({ aiBlurb, updatedAt: new Date() })
      .where(eq(sitesTable.slug, req.params.slug))
      .returning();

    return res.json(siteToResponse(updated));
  } catch (err) {
    req.log.error({ err }, "generate content error");
    return res.status(500).json({ error: "Failed to generate content" });
  }
});

// POST /sites/:slug/contact - contact form
router.post("/:slug/contact", async (req, res) => {
  const { name, email, phone, message } = req.body as {
    name: string;
    email: string;
    phone?: string;
    message: string;
  };

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [site] = await db.select().from(sitesTable).where(eq(sitesTable.slug, req.params.slug));
    if (!site) return res.status(404).json({ error: "Site not found" });

    const mjKey = process.env.MAILJET_API_KEY;
    const mjSecret = process.env.MAILJET_API_SECRET;

    if (mjKey && mjSecret && site.email) {
      const auth = Buffer.from(`${mjKey}:${mjSecret}`).toString("base64");
      await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          Messages: [{
            From: { Email: "noreply@zappweb.co.uk", Name: "ZappWeb" },
            To: [{ Email: site.email, Name: site.businessName }],
            Subject: `New enquiry from ${name}`,
            TextPart: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "N/A"}\n\n${message}`,
          }],
        }),
      });
    }

    return res.json({ message: "Message sent successfully" });
  } catch (err) {
    req.log.error({ err }, "contact form error");
    return res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /sites/:slug/checkout
router.post("/:slug/checkout", async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const { plan, successUrl, cancelUrl } = req.body as {
    plan: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);
    const [site] = await db.select().from(sitesTable).where(eq(sitesTable.slug, req.params.slug));
    if (!site) return res.status(404).json({ error: "Site not found" });

    const priceId = plan === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_LIVE_PRICE_ID;

    if (!priceId) {
      return res.status(503).json({ error: `Stripe price ID for ${plan} not configured` });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${process.env.APP_URL}/s/${req.params.slug}/admin?upgraded=true`,
      cancel_url: cancelUrl || `${process.env.APP_URL}/s/${req.params.slug}/admin`,
      metadata: { siteSlug: req.params.slug, plan },
      customer_email: site.email || undefined,
    });

    return res.json({ checkoutUrl: session.url });
  } catch (err) {
    req.log.error({ err }, "checkout error");
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;
