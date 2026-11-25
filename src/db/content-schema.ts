import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { garmentCatalog, people, userAccounts } from "./schema";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

/** One asset record, reused through foreign keys; image pixels live in Cloudinary. */
export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  sha256: text("sha256").unique(),
  cloudinaryPublicId: text("cloudinary_public_id").unique(),
  secureUrl: text("secure_url"),
  originalFileName: text("original_file_name").notNull(),
  width: integer("width"), height: integer("height"), bytes: integer("bytes"), format: text("format"),
  altText: text("alt_text").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdBy: uuid("created_by").references(() => userAccounts.id),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [
  index("media_status_idx").on(t.status),
  check("media_status_valid", sql`${t.status} in ('pending', 'ready', 'archived')`),
  check("media_ready_reference", sql`${t.status} <> 'ready' OR (${t.cloudinaryPublicId} IS NOT NULL AND ${t.secureUrl} IS NOT NULL)`),
]);

export const shopSettings = pgTable("shop_settings", {
  id: integer("id").primaryKey().default(1),
  nameBn: text("name_bn").notNull().default("TailorPro"),
  nameEn: text("name_en").notNull().default("TailorPro"),
  tagline: text("tagline").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  facebookUrl: text("facebook_url").notNull().default(""),
  foundedYear: integer("founded_year"),
  timezone: text("timezone").notNull().default("Asia/Dhaka"),
  currency: text("currency").notNull().default("BDT"),
  invoiceFooter: text("invoice_footer").notNull().default(""),
  logoAssetId: uuid("logo_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  heroAssetId: uuid("hero_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  aboutAssetId: uuid("about_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  updatedBy: uuid("updated_by").references(() => userAccounts.id),
  updatedAt: updatedAt(),
}, (t) => [
  check("shop_singleton", sql`${t.id} = 1`),
  check("shop_founded_year_valid", sql`${t.foundedYear} IS NULL OR ${t.foundedYear} between 1800 and 2200`),
]);

export const shopHours = pgTable("shop_hours", {
  shopId: integer("shop_id").notNull().default(1).references(() => shopSettings.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(),
  closed: boolean("closed").notNull().default(false),
  opensAtMinute: integer("opens_at_minute").notNull().default(600),
  closesAtMinute: integer("closes_at_minute").notNull().default(1260),
  slotMinutes: integer("slot_minutes").notNull().default(30),
}, (t) => [
  primaryKey({ columns: [t.shopId, t.weekday] }),
  check("shop_weekday_valid", sql`${t.weekday} between 0 and 6`),
  check("shop_hours_valid", sql`${t.opensAtMinute} >= 0 AND ${t.closesAtMinute} <= 1440 AND ${t.opensAtMinute} < ${t.closesAtMinute} AND ${t.slotMinutes} between 5 and 120`),
]);

export const sitePages = pgTable("site_pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  intro: text("intro").notNull().default(""),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  published: boolean("published").notNull().default(true),
  updatedBy: uuid("updated_by").references(() => userAccounts.id),
  updatedAt: updatedAt(),
});

export const siteSections = pgTable("site_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageSlug: text("page_slug").notNull().references(() => sitePages.slug, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  heading: text("heading").notNull().default(""),
  body: text("body").notNull().default(""),
  subtitle: text("subtitle").notNull().default(""),
  label: text("label").notNull().default(""),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
  position: integer("position").notNull().default(0),
  published: boolean("published").notNull().default(true),
  updatedBy: uuid("updated_by").references(() => userAccounts.id),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("site_sections_page_idx").on(t.pageSlug, t.position), uniqueIndex("site_sections_position_uq").on(t.pageSlug, t.position)]);

export const serviceDetails = pgTable("service_details", {
  garmentTypeId: uuid("garment_type_id").primaryKey().references(() => garmentCatalog.id, { onDelete: "cascade" }),
  summary: text("summary").notNull().default(""),
  features: text("features").array().notNull().default(sql`'{}'`),
  mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  featured: boolean("featured").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => userAccounts.id),
  updatedAt: updatedAt(),
});

export const galleryEntries = pgTable("gallery_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  mediaAssetId: uuid("media_asset_id").notNull().references(() => mediaAssets.id),
  title: text("title").notNull(),
  caption: text("caption").notNull().default(""),
  category: text("category").notNull().default(""),
  position: integer("position").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdBy: uuid("created_by").references(() => userAccounts.id),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("gallery_position_idx").on(t.position), uniqueIndex("gallery_asset_uq").on(t.mediaAssetId)]);
