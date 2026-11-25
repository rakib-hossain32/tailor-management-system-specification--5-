import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerAccounts, garmentSchemaVersions, garmentTypes, measurementProfiles, measurementSets, measurementVersions } from "@/db/schema";
import { ApiError, isUuid } from "@/lib/api-route";
import { stringRecord, text } from "@/lib/api-input";
import { toCm, type Unit } from "@/lib/units";
import { flattenFields, validateMeasurementValues, type MeasurementSchema } from "@/lib/measurements";

import { recordAudit } from "@/server/audit";
import { authorize, page, present, uuid, type Actor, type Input, type ListOptions } from "./ops-common";
import "server-only";
const SOURCES = ["in_store", "reused", "fit_adjusted", "from_garment", "self_reported", "remote_assisted", "standard_size"];

/** Create an immutable version, with one current snapshot for this profile/garment. */
export async function createMeasurement(staff: Actor, input: Input) {
  authorize(staff);
  const body: Input = { ...input, profile_id: input.profile_id ?? input.profileId, garment_type_id: input.garment_type_id ?? input.garmentTypeId, unit_entered: input.unit_entered ?? input.unitEntered, based_on_set_id: input.based_on_set_id ?? input.basedOnSetId, change_note: input.change_note ?? input.changeNote };
  const profileId = body.profile_id;
  const garmentId = body.garment_type_id;
  if (!isUuid(profileId) || !isUuid(garmentId)) throw new ApiError(400, "VALIDATION_ERROR", "মাপ প্রোফাইল ও পোশাকের ধরন সঠিকভাবে বাছুন");
  const unitEntered = text(body.unit_entered, "মাপের একক", 10) ?? "inch";
  if (unitEntered !== "inch" && unitEntered !== "cm") throw new ApiError(400, "VALIDATION_ERROR", "মাপের একক inch অথবা cm দিন");
  const unit: Unit = unitEntered;
  const source = text(body.source, "মাপের উৎস", 30) ?? "in_store";
  if (!SOURCES.includes(source)) throw new ApiError(400, "VALIDATION_ERROR", "মাপের উৎস সঠিকভাবে বাছুন");
  if (body.verified !== undefined && typeof body.verified !== "boolean") throw new ApiError(400, "VALIDATION_ERROR", "যাচাইয়ের তথ্য সঠিকভাবে দিন");
  const verified = body.verified === true;
  const basedOnId = body.based_on_set_id == null ? null : body.based_on_set_id;
  if (basedOnId !== null && !isUuid(basedOnId)) throw new ApiError(400, "VALIDATION_ERROR", "আগের মাপের পরিচয় সঠিক নয়");
  const styles = stringRecord(body.styles, "পোশাকের স্টাইল");
  const notes = text(body.notes, "নোট") || null;
  const changeNote = text(body.change_note, "পরিবর্তনের কারণ") || null;
  if (!body.values || typeof body.values !== "object" || Array.isArray(body.values) || Object.keys(body.values).length > 100) {
    throw new ApiError(400, "VALIDATION_ERROR", "মাপগুলো সঠিকভাবে দিন");
  }
  const [garment] = await db.select().from(garmentTypes).where(and(eq(garmentTypes.id, garmentId), eq(garmentTypes.isActive, true))).limit(1);
  if (!garment) throw new ApiError(404, "NOT_FOUND", "পোশাকের ধরন পাওয়া যায়নি");
  const schema = garment.measurementSchema as unknown as MeasurementSchema;
  const keys = new Set(flattenFields(schema).map((field) => field.key));
  const valuesCm: Record<string, number> = {};
  for (const [key, value] of Object.entries(body.values)) {
    if (!keys.has(key) || (typeof value !== "number" && typeof value !== "string")) throw new ApiError(422, "VALIDATION_ERROR", "মাপের ঘর বা মান সঠিক নয়");
    if (typeof value === "string" && value.trim() === "") continue;
    const parsed = typeof value === "number" ? value : Number(value.trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) throw new ApiError(422, "VALIDATION_ERROR", "মাপ শূন্যের বেশি সঠিক সংখ্যা হতে হবে");
    valuesCm[key] = toCm(parsed, unit);
  }
  const issues = validateMeasurementValues(schema, valuesCm);
  const blocking = issues.filter((issue) => issue.severity === "error");
  if (blocking.length) throw new ApiError(422, "VALIDATION_ERROR", blocking[0].message_bn);
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'measurement:' + profileId + ':' + garmentId}))`);
    const [profile] = await tx.select({ id: measurementProfiles.id }).from(measurementProfiles).innerJoin(customerAccounts, eq(measurementProfiles.customerId, customerAccounts.id)).where(and(eq(measurementProfiles.id, profileId), eq(measurementProfiles.isActive, true), eq(customerAccounts.isActive, true))).limit(1);
    if (!profile) throw new ApiError(404, "NOT_FOUND", "মাপ প্রোফাইল পাওয়া যায়নি");
    if (basedOnId) {
      const [base] = await tx.select().from(measurementSets).where(eq(measurementSets.id, basedOnId)).limit(1);
      if (!base || base.profileId !== profileId || base.garmentTypeId !== garmentId) throw new ApiError(422, "SNAPSHOT_MISMATCH", "আগের মাপটি এই প্রোফাইল ও পোশাকের নয়");
    }
    const [previous] = await tx.select({ id: measurementSets.id, version: measurementSets.version }).from(measurementSets)
      .where(and(eq(measurementSets.profileId, profileId), eq(measurementSets.garmentTypeId, garmentId)))
      .orderBy(desc(measurementSets.version)).limit(1);
    const now = new Date();
    const [row] = await tx.insert(measurementVersions).values({
      profileId, garmentSchemaVersionId: garment.activeSchemaVersionId, version: (previous?.version ?? 0) + 1, values: valuesCm, styles,
      unitEntered: unit, source, verifiedBy: verified ? staff.userId : null, verifiedAt: verified ? now : null,
      measuredBy: staff.userId, measuredAt: now, basedOnSetId: basedOnId ?? previous?.id ?? null,
      changeNote, notes,
    }).returning();
    await recordAudit(tx, { actorId: staff.userId, action: "create-version", entity: "measurement", entityId: row.id, details: { profileId, garmentSchemaVersionId: garment.activeSchemaVersionId, version: row.version } });
    return row;
  });
  return { id: result.id, version: result.version, is_current: true, warnings: issues.filter((issue) => issue.severity === "warning") };
}

export async function listMeasurements(actor: Actor, options: ListOptions & { profileId?: string; garmentTypeId?: string; currentOnly?: boolean } = {}) {
  authorize(actor);
  const p = page(options);
  const filter = and(options.profileId ? eq(measurementSets.profileId, uuid(options.profileId)) : undefined, options.garmentTypeId ? eq(measurementSets.garmentTypeId, uuid(options.garmentTypeId)) : undefined, options.currentOnly ? eq(measurementSets.isCurrent, true) : undefined);
  const [rows, count] = await Promise.all([db.select().from(measurementSets).where(filter).orderBy(desc(measurementSets.measuredAt)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(measurementSets).where(filter)]);
  return { rows, total: count[0].n, page: p.page, limit: p.limit };
}

export async function getMeasurement(actor: Actor, id: string) {
  authorize(actor);
  const measurement = present((await db.select().from(measurementSets).where(eq(measurementSets.id, uuid(id))).limit(1))[0], "মাপ");
  const schema = present((await db.select().from(garmentSchemaVersions).where(eq(garmentSchemaVersions.id, measurement.garmentSchemaVersionId)).limit(1))[0], "ঐতিহাসিক মাপের স্কিমা");
  return { ...measurement, measurement_schema: schema.measurementSchema, style_schema: schema.styleSchema };
}
