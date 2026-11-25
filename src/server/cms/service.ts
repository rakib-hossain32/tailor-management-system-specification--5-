import "server-only";
import { cache } from "react";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  garmentTypes,
  measurementSets,
  orders,
  people,
  workers,
} from "@/db/schema";
import {
  galleryEntries,
  mediaAssets,
  serviceDetails,
  shopHours,
  shopSettings,
  sitePages,
  siteSections,
} from "@/db/content-schema";
import { dhakaDate } from "@/lib/appointments";
import type { PublicShop, PublicSiteSnapshot } from "./types";

export type { PublicSiteSnapshot } from "./types";

/** Read one canonical snapshot; no editorial or business records are invented in the renderer. */
export const getPublicSiteSnapshot = cache(
  async (): Promise<PublicSiteSnapshot> => {
    const [
      shops,
      hours,
      pages,
      sections,
      assets,
      garments,
      details,
      gallery,
      customerCounts,
      measurementCounts,
      orderCounts,
      workerCounts,
    ] = await Promise.all([
      db.select().from(shopSettings).where(eq(shopSettings.id, 1)).limit(1),
      db
        .select()
        .from(shopHours)
        .where(eq(shopHours.shopId, 1))
        .orderBy(asc(shopHours.weekday)),
      db.select().from(sitePages).where(eq(sitePages.published, true)),
      db
        .select({ section: siteSections, personName: people.name })
        .from(siteSections)
        .leftJoin(people, eq(siteSections.personId, people.id))
        .where(eq(siteSections.published, true))
        .orderBy(asc(siteSections.position)),
      db.select().from(mediaAssets).where(eq(mediaAssets.status, "ready")),
      db
        .select()
        .from(garmentTypes)
        .where(eq(garmentTypes.isActive, true))
        .orderBy(asc(garmentTypes.sortOrder)),
      db.select().from(serviceDetails),
      db
        .select()
        .from(galleryEntries)
        .where(eq(galleryEntries.published, true))
        .orderBy(asc(galleryEntries.position)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(eq(customers.isActive, true)),
      db.select({ count: sql<number>`count(*)::int` }).from(measurementSets),
      db
        .select({
          delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
          today: sql<number>`count(*) filter (where ${orders.orderDate} = ${dhakaDate()})::int`,
        })
        .from(orders),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(workers)
        .where(eq(workers.isActive, true)),
    ]);
    const assetMap = new Map(
      assets.map((asset) => [asset.id, asset.secureUrl]),
    );
    const imageUrl = (id: string | null | undefined) =>
      id ? (assetMap.get(id) ?? null) : null;
    const source = shops[0];
    const shop: PublicShop = {
      nameBn: source?.nameBn ?? "TailorPro",
      nameEn: source?.nameEn ?? "TailorPro",
      tagline: source?.tagline ?? "",
      address: source?.address ?? "",
      phone: source?.phone ?? "",
      email: source?.email ?? "",
      whatsapp: source?.whatsapp ?? "",
      facebookUrl: source?.facebookUrl ?? "",
      foundedYear: source?.foundedYear ?? null,
      invoiceFooter: source?.invoiceFooter ?? "",
      logoUrl: imageUrl(source?.logoAssetId),
      heroUrl: imageUrl(source?.heroAssetId),
      aboutUrl: imageUrl(source?.aboutAssetId),
      timezone: source?.timezone ?? "Asia/Dhaka",
      currency: source?.currency ?? "BDT",
      hours: hours.map(
        ({ weekday, closed, opensAtMinute, closesAtMinute, slotMinutes }) => ({
          weekday,
          closed,
          opensAtMinute,
          closesAtMinute,
          slotMinutes,
        }),
      ),
    };
    const detailMap = new Map(
      details.map((detail) => [detail.garmentTypeId, detail]),
    );
    return {
      shop,
      pages: Object.fromEntries(
        pages.map((page) => [
          page.slug,
          {
            slug: page.slug,
            title: page.title,
            intro: page.intro,
            seoTitle: page.seoTitle,
            seoDescription: page.seoDescription,
            sections: sections
              .filter((row) => row.section.pageSlug === page.slug)
              .map(({ section, personName }) => ({
                id: section.id,
                kind: section.kind,
                heading: section.heading,
                body: section.body,
                subtitle: section.subtitle,
                label: section.label,
                position: section.position,
                imageUrl: imageUrl(section.mediaAssetId),
                personName,
              })),
          },
        ]),
      ),
      garments: garments.map((garment) => {
        const detail = detailMap.get(garment.id);
        return {
          id: garment.id,
          code: garment.code,
          nameBn: garment.nameBn,
          nameEn: garment.nameEn,
          category: garment.category,
          basePrice: garment.basePrice,
          defaultDeliveryDays: garment.defaultDeliveryDays,
          defaultFabricEstimate: garment.defaultFabricEstimate,
          summary: detail?.summary ?? "",
          features: detail?.features ?? [],
          imageUrl: imageUrl(detail?.mediaAssetId),
          featured: detail?.featured ?? false,
        };
      }),
      gallery: gallery.flatMap((entry) => {
        const url = imageUrl(entry.mediaAssetId);
        return url
          ? [
              {
                id: entry.id,
                title: entry.title,
                caption: entry.caption,
                category: entry.category,
                imageUrl: url,
              },
            ]
          : [];
      }),
      stats: {
        customers: Number(customerCounts[0]?.count ?? 0),
        measurements: Number(measurementCounts[0]?.count ?? 0),
        deliveredOrders: Number(orderCounts[0]?.delivered ?? 0),
        todayOrders: Number(orderCounts[0]?.today ?? 0),
        workers: Number(workerCounts[0]?.count ?? 0),
        years: shop.foundedYear
          ? Math.max(0, new Date().getFullYear() - shop.foundedYear)
          : null,
      },
    };
  },
);
