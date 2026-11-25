import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
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

/** Read the public content and live business counts used by all public routes. */
export async function loadPublicSiteData() {
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
    db.select().from(mediaAssets).where(inArray(mediaAssets.status, ["pending", "ready"])),
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

  return {
    shop: shops[0] ?? null,
    hours,
    pages,
    sections,
    assets,
    garments,
    serviceDetails: details,
    gallery,
    customerCount: Number(customerCounts[0]?.count ?? 0),
    measurementCount: Number(measurementCounts[0]?.count ?? 0),
    deliveredOrderCount: Number(orderCounts[0]?.delivered ?? 0),
    todayOrderCount: Number(orderCounts[0]?.today ?? 0),
    workerCount: Number(workerCounts[0]?.count ?? 0),
  };
}
