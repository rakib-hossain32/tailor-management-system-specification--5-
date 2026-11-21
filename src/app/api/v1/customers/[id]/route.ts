import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customers, measurementProfiles, measurementSets } from "@/db/schema";
import { adminRoute, ApiError, isUuid } from "@/lib/api-route";

export const dynamic = "force-dynamic";

/** Profiles and current snapshots, scoped to the selected customer. */
export const GET = adminRoute(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "কাস্টমারের পরিচয় সঠিক নয়");
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) throw new ApiError(404, "NOT_FOUND", "কাস্টমার পাওয়া যায়নি");
  const profiles = await db.select().from(measurementProfiles).where(eq(measurementProfiles.customerId, id));
  const sets = profiles.length ? await db.select().from(measurementSets)
    .where(and(inArray(measurementSets.profileId, profiles.map((profile) => profile.id)), eq(measurementSets.isCurrent, true))) : [];
  return NextResponse.json({
    id: customer.id, name: customer.name, phone: customer.phone,
    profiles: profiles.map((profile) => ({
      id: profile.id, display_name: profile.displayName, relation: profile.relation, is_default: profile.isDefault,
      sets: sets.filter((set) => set.profileId === profile.id).map((set) => ({ id: set.id, garment_type_id: set.garmentTypeId, version: set.version, measured_at: set.measuredAt.toISOString(), source: set.source, verified: set.verified })),
    })),
  });
});
