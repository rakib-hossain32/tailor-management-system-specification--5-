import "server-only";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { garmentCatalog, people } from "@/db/schema";
import { galleryEntries, mediaAssets, serviceDetails, shopHours, shopSettings, sitePages, siteSections } from "@/db/content-schema";
import { ApiError } from "@/lib/api-route";
import { recordAudit } from "@/server/audit";
import type { StaffSession } from "@/lib/access";

const text = (max = 2000) => z.string().trim().max(max);
const id = z.uuid();
const mediaId = id.nullable().optional();
const pageSlug = z.enum(["home", "about", "services", "gallery", "contact", "how-it-works", "terms", "privacy"]);
const shopInput = z.object({
  nameBn: text(120).min(1), nameEn: text(120).min(1), tagline: text(300), address: text(500),
  phone: text(40), email: z.union([z.email(), z.literal("")]), whatsapp: text(40),
  facebookUrl: z.union([z.url().refine((url) => url.startsWith("https://")), z.literal("")]),
  foundedYear: z.number().int().min(1800).max(new Date().getFullYear()).nullable(),
  invoiceFooter: text(2000), logoAssetId: mediaId, heroAssetId: mediaId, aboutAssetId: mediaId,
});
const hoursInput = z.array(z.object({ weekday: z.number().int().min(0).max(6), closed: z.boolean(),
  opensAtMinute: z.number().int().min(0).max(1439), closesAtMinute: z.number().int().min(1).max(1440),
  slotMinutes: z.number().int().min(5).max(120),
}).refine((row) => row.closesAtMinute > row.opensAtMinute, "Closing time must follow opening time")).length(7)
  .refine((rows) => new Set(rows.map((row) => row.weekday)).size === 7, "Each weekday must occur once");
const pageInput = z.object({ slug: pageSlug, title: text(200).min(1), intro: text(5000), seoTitle: text(200), seoDescription: text(500), published: z.boolean() });
const sectionInput = z.object({ pageSlug, kind: z.enum(["hero", "benefit", "process", "paragraph", "testimonial", "team", "milestone", "faq", "policy", "service", "statistic", "tracking", "cta", "showroom"]),
  heading: text(300), body: text(10000), subtitle: text(300), label: text(120), position: z.number().int().min(0).max(10000),
  data: z.record(z.string(), z.unknown()).default({}),
  published: z.boolean(), mediaAssetId: mediaId, personId: id.nullable().optional() });
const galleryInput = z.object({ mediaAssetId: id, title: text(200).min(1), caption: text(2000), category: text(100), position: z.number().int().min(0), published: z.boolean() });
const serviceInput = z.object({ garmentTypeId: id, summary: text(5000), features: z.array(text(300)).max(20), featured: z.boolean(), mediaAssetId: mediaId });

function owner(actor: StaffSession) {
  if (!["owner", "manager"].includes(actor.role)) throw new ApiError(403, "FORBIDDEN", "সাইটের তথ্য পরিবর্তনের অনুমতি নেই");
}

export async function getAdminSiteContent(actor: StaffSession) {
  owner(actor);
  const [shop, hours, pages, sections, services, gallery, media, garments, personRows] = await Promise.all([
    db.select().from(shopSettings).where(eq(shopSettings.id, 1)).limit(1),
    db.select().from(shopHours).orderBy(asc(shopHours.weekday)), db.select().from(sitePages),
    db.select().from(siteSections).orderBy(asc(siteSections.position)), db.select().from(serviceDetails),
    db.select().from(galleryEntries).orderBy(asc(galleryEntries.position)), db.select().from(mediaAssets),
    db.select({ id: garmentCatalog.id, code: garmentCatalog.code, nameBn: garmentCatalog.nameBn }).from(garmentCatalog),
    db.select({ id: people.id, name: people.name }).from(people),
  ]);
  return { shop: shop[0] ?? null, hours, pages, sections, services, gallery, media, garments, people: personRows };
}

/** CMS entries contain presentation text; entities/media remain FK references. */
export async function saveSiteContent(kind: string, input: unknown, actor: StaffSession, existingId?: string) {
  owner(actor);
  return db.transaction(async (tx) => {
    let saved: unknown;
    let entityId: string;
    if (kind === "shop") {
      const values = shopInput.parse(input);
      const [row] = await tx.insert(shopSettings).values({ ...values, id: 1, updatedBy: actor.userId })
        .onConflictDoUpdate({ target: shopSettings.id, set: { ...values, updatedBy: actor.userId, updatedAt: new Date() } }).returning();
      saved = row; entityId = "1";
    } else if (kind === "hours") {
      const values = hoursInput.parse(input);
      for (const row of values) await tx.insert(shopHours).values({ ...row, shopId: 1 })
        .onConflictDoUpdate({ target: [shopHours.shopId, shopHours.weekday], set: row });
      saved = values; entityId = "1";
    } else if (kind === "pages") {
      const values = pageInput.parse(input);
      const [row] = await tx.insert(sitePages).values({ ...values, updatedBy: actor.userId })
        .onConflictDoUpdate({ target: sitePages.slug, set: { ...values, updatedBy: actor.userId, updatedAt: new Date() } }).returning();
      saved = row; entityId = values.slug;
    } else if (kind === "sections") {
      const values = sectionInput.parse(input);
      if (existingId) id.parse(existingId);
      const [row] = existingId
        ? await tx.update(siteSections).set({ ...values, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(siteSections.id, existingId)).returning()
        : await tx.insert(siteSections).values({ ...values, updatedBy: actor.userId }).returning();
      if (!row) throw new ApiError(404, "NOT_FOUND", "সাইটের অংশটি পাওয়া যায়নি");
      saved = row; entityId = row.id;
    } else if (kind === "services") {
      const values = serviceInput.parse(input);
      const [row] = await tx.insert(serviceDetails).values({ ...values, updatedBy: actor.userId })
        .onConflictDoUpdate({ target: serviceDetails.garmentTypeId, set: { ...values, updatedBy: actor.userId, updatedAt: new Date() } }).returning();
      saved = row; entityId = values.garmentTypeId;
    } else if (kind === "gallery") {
      const values = galleryInput.parse(input);
      if (existingId) id.parse(existingId);
      const [row] = existingId
        ? await tx.update(galleryEntries).set({ ...values, updatedAt: new Date() }).where(eq(galleryEntries.id, existingId)).returning()
        : await tx.insert(galleryEntries).values({ ...values, createdBy: actor.userId }).returning();
      if (!row) throw new ApiError(404, "NOT_FOUND", "গ্যালারির ছবিটি পাওয়া যায়নি");
      saved = row; entityId = row.id;
    } else throw new ApiError(404, "NOT_FOUND", "সাইটের তথ্যের ধরন সঠিক নয়");
    await recordAudit(tx, { actorId: actor.userId, action: existingId ? "update" : "save", entity: "site_" + kind, entityId });
    return saved;
  });
}

export async function deleteSiteContent(kind: string, existingId: string, actor: StaffSession) {
  owner(actor);
  return db.transaction(async (tx) => {
    if (kind === "sections") {
      id.parse(existingId);
      const rows = await tx.delete(siteSections).where(eq(siteSections.id, existingId)).returning({ id: siteSections.id });
      if (!rows.length) throw new ApiError(404, "NOT_FOUND", "সাইটের অংশটি পাওয়া যায়নি");
    } else if (kind === "gallery") {
      id.parse(existingId);
      const rows = await tx.delete(galleryEntries).where(eq(galleryEntries.id, existingId)).returning({ id: galleryEntries.id });
      if (!rows.length) throw new ApiError(404, "NOT_FOUND", "গ্যালারির তথ্য পাওয়া যায়নি");
    } else if (kind === "pages") {
      pageSlug.parse(existingId);
      await tx.update(sitePages).set({ published: false, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(sitePages.slug, existingId));
    } else throw new ApiError(409, "CANNOT_DELETE_CONFIGURATION", "মূল দোকান ও service configuration সম্পাদনা করুন");
    await recordAudit(tx, { actorId: actor.userId, action: "delete", entity: "site_" + kind, entityId: existingId });
    return { ok: true };
  });
}
