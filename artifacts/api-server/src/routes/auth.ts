import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, sitesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { TenantLoginBody, SetupTenantBody } from "@workspace/api-zod";

const router = Router();

// Quick check — no password required, tells client if setup is needed
router.get("/tenant/check", async (req, res) => {
  const slug = req.query.slug as string;
  if (!slug) return res.status(400).json({ error: "Missing slug" });
  try {
    const [site] = await db.select({ passwordHash: sitesTable.passwordHash }).from(sitesTable).where(eq(sitesTable.slug, slug));
    if (!site) return res.status(404).json({ error: "Site not found" });
    return res.json({ needsSetup: !site.passwordHash });
  } catch (err) {
    req.log.error({ err }, "check error");
    return res.status(500).json({ error: "Check failed" });
  }
});

router.post("/tenant/setup", async (req, res) => {
  const parsed = SetupTenantBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing slug or password" });
  }
  const { slug, password } = parsed.data;

  try {
    const [site] = await db.select().from(sitesTable).where(eq(sitesTable.slug, slug));
    if (!site) return res.status(404).json({ error: "Site not found" });
    if (site.passwordHash) {
      return res.status(409).json({ error: "Credentials already set — use login" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(sitesTable).set({ passwordHash, updatedAt: new Date() }).where(eq(sitesTable.slug, slug));

    const session = req.session as { tenantSlug?: string };
    session.tenantSlug = slug;

    return res.json({ slug: site.slug, businessName: site.businessName, tier: site.tier, authenticated: true });
  } catch (err) {
    req.log.error({ err }, "tenant setup error");
    return res.status(500).json({ error: "Setup failed" });
  }
});

router.post("/tenant/login", async (req, res) => {
  const parsed = TenantLoginBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Missing slug or password" });
  }
  const { slug, password } = parsed.data;

  try {
    const [site] = await db.select().from(sitesTable).where(eq(sitesTable.slug, slug));
    if (!site) return res.status(401).json({ error: "Invalid credentials" });

    if (!site.passwordHash) {
      return res.json({ authenticated: false, needsSetup: true });
    }

    const valid = await bcrypt.compare(password, site.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const session = req.session as { tenantSlug?: string };
    session.tenantSlug = slug;

    return res.json({ slug: site.slug, businessName: site.businessName, tier: site.tier, authenticated: true });
  } catch (err) {
    req.log.error({ err }, "tenant login error");
    return res.status(500).json({ error: "Login failed" });
  }
});

router.post("/tenant/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/tenant/me", async (req, res) => {
  const session = req.session as { tenantSlug?: string };
  if (!session.tenantSlug) {
    return res.json({ authenticated: false });
  }
  try {
    const [site] = await db.select().from(sitesTable).where(eq(sitesTable.slug, session.tenantSlug));
    if (!site) return res.json({ authenticated: false });
    if (!site.passwordHash) return res.json({ authenticated: false, needsSetup: true, slug: site.slug });
    return res.json({ slug: site.slug, businessName: site.businessName, tier: site.tier, authenticated: true });
  } catch (err) {
    req.log.error({ err }, "session check error");
    return res.json({ authenticated: false });
  }
});

export default router;
