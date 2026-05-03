import { pgTable, serial, text, integer, timestamp, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sitesTable = pgTable("sites", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  placeId: text("place_id"),
  businessName: text("business_name").notNull(),
  themeId: text("theme_id").notNull().default("modern"),
  tier: text("tier").notNull().default("demo"), // demo | live | pro
  address: text("address"),
  postcode: text("postcode"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  blurb: text("blurb"),
  aiBlurb: text("ai_blurb"),
  openingHours: jsonb("opening_hours").$type<string[]>().default([]),
  logoUrl: text("logo_url"),
  photos: jsonb("photos").$type<string[]>().default([]),
  brandColors: jsonb("brand_colors").$type<string[]>().default([]),
  socialLinks: jsonb("social_links").$type<{
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    twitter?: string;
  }>().default({}),
  headCode: text("head_code"),
  lat: real("lat"),
  lng: real("lng"),
  customDomain: text("custom_domain"),
  demoExpiresAt: timestamp("demo_expires_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  passwordHash: text("password_hash"),
  fontPair: text("font_pair"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSiteSchema = createInsertSchema(sitesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSiteSchema = createSelectSchema(sitesTable);
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sitesTable.$inferSelect;
