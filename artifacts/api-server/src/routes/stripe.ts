import { Router } from "express";
import { db, sitesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/webhook", async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey) {
    return res.status(503).json({ message: "Stripe not configured" });
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);

    let event;
    if (webhookSecret) {
      const sig = req.headers["stripe-signature"];
      if (!sig) return res.status(400).json({ message: "Missing stripe-signature" });
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } else {
      event = req.body;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        metadata?: { siteSlug?: string; plan?: string };
        customer?: string;
        subscription?: string;
      };
      const siteSlug = session.metadata?.siteSlug;
      const plan = session.metadata?.plan as "live" | "pro" | undefined;

      if (siteSlug && plan) {
        await db.update(sitesTable)
          .set({
            tier: plan,
            stripeCustomerId: session.customer as string || undefined,
            stripeSubscriptionId: session.subscription as string || undefined,
            updatedAt: new Date(),
          })
          .where(eq(sitesTable.slug, siteSlug));
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as { id: string };
      await db.update(sitesTable)
        .set({ tier: "demo", stripeSubscriptionId: null, updatedAt: new Date() })
        .where(eq(sitesTable.stripeSubscriptionId, sub.id));
    }

    return res.json({ message: "ok" });
  } catch (err) {
    req.log.error({ err }, "stripe webhook error");
    return res.status(400).json({ message: "Webhook error" });
  }
});

export default router;
