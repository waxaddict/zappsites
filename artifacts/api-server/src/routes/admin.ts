import { Router } from "express";
import { db, sitesTable } from "@workspace/db";
import { eq, count, and, lt, gte } from "drizzle-orm";
import { SetTenantTierBody } from "@workspace/api-zod";

const router = Router();

function siteToTenantRecord(site: typeof sitesTable.$inferSelect) {
  return {
    id: site.id,
    slug: site.slug,
    businessName: site.businessName,
    themeId: site.themeId,
    tier: site.tier as "demo" | "live" | "pro",
    address: site.address || "",
    email: site.email || "",
    logoUrl: site.logoUrl || "",
    demoExpiresAt: site.demoExpiresAt?.toISOString(),
    stripeSubscriptionId: site.stripeSubscriptionId || "",
    createdAt: site.createdAt.toISOString(),
  };
}

router.get("/stats", async (req, res) => {
  try {
    const allSites = await db.select().from(sitesTable).orderBy(sitesTable.createdAt);

    const now = new Date();
    const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const totalSites = allSites.length;
    const demoSites = allSites.filter((s) => s.tier === "demo").length;
    const liveSites = allSites.filter((s) => s.tier === "live").length;
    const proSites = allSites.filter((s) => s.tier === "pro").length;
    const expiringThisWeek = allSites.filter(
      (s) => s.tier === "demo" && s.demoExpiresAt && s.demoExpiresAt <= oneWeek && s.demoExpiresAt > now
    ).length;

    const recentSites = allSites
      .slice(-5)
      .reverse()
      .map(siteToTenantRecord);

    return res.json({
      totalSites,
      demoSites,
      liveSites,
      proSites,
      expiringThisWeek,
      recentSites,
    });
  } catch (err) {
    req.log.error({ err }, "admin stats error");
    return res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/tenants", async (req, res) => {
  try {
    const sites = await db.select().from(sitesTable).orderBy(sitesTable.createdAt);
    return res.json({ tenants: sites.map(siteToTenantRecord) });
  } catch (err) {
    req.log.error({ err }, "list tenants error");
    return res.status(500).json({ error: "Failed to list tenants" });
  }
});

router.put("/tenants/:slug/tier", async (req, res) => {
  const parsed = SetTenantTierBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid tier" });
  }

  try {
    const [site] = await db.update(sitesTable)
      .set({ tier: parsed.data.tier, updatedAt: new Date() })
      .where(eq(sitesTable.slug, req.params.slug))
      .returning();

    if (!site) return res.status(404).json({ error: "Site not found" });
    return res.json(siteToTenantRecord(site));
  } catch (err) {
    req.log.error({ err }, "set tier error");
    return res.status(500).json({ error: "Failed to update tier" });
  }
});

export default router;
