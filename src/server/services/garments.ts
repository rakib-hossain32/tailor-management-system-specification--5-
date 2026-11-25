import "server-only";
import { asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { garmentCatalog, garmentSchemaVersions, garmentStageRates, garmentTypes } from "@/db/schema";
import { ApiError } from "@/lib/api-route";
import { numberValue } from "@/lib/api-input";
import { recordAudit } from "@/server/audit";
import type { Transaction } from "@/server/repositories/people";
import type { MeasurementSchema, StyleSchema } from "@/lib/measurements";
import { amount, authorize, bool, changedFields, choice, page, present, quantity, required, uuid, type Actor, type Input, type ListOptions, STAGES } from "./ops-common";

function schema(value: unknown): MeasurementSchema {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(422, "INVALID_SCHEMA", "মাপের ফিল্ড দিন");
  const data = value as MeasurementSchema;
  if (data.unit !== "cm" || !Array.isArray(data.groups) || !data.groups.length || data.groups.length > 20 || !Array.isArray(data.validation_rules)) throw new ApiError(422, "INVALID_SCHEMA", "মাপের স্কিমা সঠিক নয়");
  const keys = new Set<string>();
  for (const group of data.groups) {
    if (!group || typeof group.key !== "string" || typeof group.label_bn !== "string" || !Array.isArray(group.fields) || !group.fields.length || group.fields.length > 100) throw new ApiError(422, "INVALID_SCHEMA", "মাপের গ্রুপ ও ফিল্ড সঠিক নয়");
    for (const field of group.fields) {
      if (!field || typeof field.key !== "string" || !/^[a-z0-9_]{1,100}$/.test(field.key) || keys.has(field.key) || typeof field.label_bn !== "string" || !field.label_bn.trim() || field.label_bn.length > 150 || typeof field.label_en !== "string" || typeof field.required !== "boolean" || !["measurement", "number", "select", "multiselect", "boolean", "text"].includes(field.type)) throw new ApiError(422, "INVALID_SCHEMA", "মাপের প্রতিটি ফিল্ডের আলাদা পরিচয় ও নাম প্রয়োজন");
      if ([field.min, field.max].some((bound) => bound !== undefined && (typeof bound !== "number" || !Number.isFinite(bound) || bound < 0)) || (field.min !== undefined && field.max !== undefined && field.min > field.max)) throw new ApiError(422, "INVALID_SCHEMA", "মাপের সর্বনিম্ন ও সর্বোচ্চ সীমা সঠিক নয়");
      keys.add(field.key);
    }
  }
  for (const rule of data.validation_rules) {
    if (!rule || !["ratio", "compare"].includes(rule.type) || !Array.isArray(rule.fields) || rule.fields.some((key) => !keys.has(key)) || !["warning", "error"].includes(rule.severity) || typeof rule.message_bn !== "string") throw new ApiError(422, "INVALID_SCHEMA", "মাপ যাচাইয়ের নিয়ম সঠিক নয়");
  }
  return data;
}
function styles(value: unknown): StyleSchema {
  const data = value ?? { options: [] };
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray((data as StyleSchema).options) || (data as StyleSchema).options.length > 100) throw new ApiError(422, "INVALID_SCHEMA", "স্টাইলের অপশন সঠিক নয়");
  const keys = new Set<string>();
  for (const option of (data as StyleSchema).options) {
    if (!option || typeof option.key !== "string" || !/^[a-z0-9_]{1,100}$/.test(option.key) || keys.has(option.key) || typeof option.label_bn !== "string" || !option.label_bn.trim() || option.label_bn.length > 150 || !["select", "multiselect", "boolean", "text"].includes(option.type)) throw new ApiError(422, "INVALID_SCHEMA", "স্টাইলের ফিল্ড সঠিক নয়");
    if (option.choices && (!Array.isArray(option.choices) || option.choices.length > 100 || option.choices.some((item) => !item || typeof item.value !== "string" || !item.value || typeof item.label_bn !== "string" || !item.label_bn.trim()) || new Set(option.choices.map((item) => item.value)).size !== option.choices.length)) throw new ApiError(422, "INVALID_SCHEMA", "স্টাইলের তালিকা সঠিক নয়");
    keys.add(option.key);
  }
  return data as StyleSchema;
}
function fields(input: Input, current?: typeof garmentCatalog.$inferSelect) {
  const code = required(input.code ?? current?.code, "পোশাকের কোড", 50).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(code)) throw new ApiError(422, "VALIDATION_ERROR", "পোশাকের কোড সঠিক নয়");
  const delivery = numberValue(input.defaultDeliveryDays, "ডেলিভারির দিন", current?.defaultDeliveryDays ?? 7, 365, true);
  if (delivery < 1) throw new ApiError(422, "VALIDATION_ERROR", "ডেলিভারির দিন অন্তত এক দিন হতে হবে");
  return { code, nameBn: required(input.nameBn ?? current?.nameBn, "পোশাকের নাম"), nameEn: required(input.nameEn ?? current?.nameEn, "পোশাকের ইংরেজি নাম"), category: choice(input.category, ["gents", "ladies", "kids", "unisex"], "ক্যাটাগরি", current?.category ?? "gents"),
    basePrice: amount(input.basePrice ?? Number(current?.basePrice ?? 0), "মূল্য"), defaultDeliveryDays: delivery, defaultFabricEstimate: input.defaultFabricEstimate === undefined ? current?.defaultFabricEstimate ?? null : input.defaultFabricEstimate === null || input.defaultFabricEstimate === "" ? null : quantity(input.defaultFabricEstimate, "প্রয়োজনীয় কাপড়").toFixed(2),
    isActive: bool(input.isActive, current?.isActive ?? true), sortOrder: numberValue(input.sortOrder, "ক্রম", current?.sortOrder ?? 0, 100000, true) };
}
export async function getCurrentStageRates(connection: Transaction | typeof db, garmentTypeId: string) {
  const rows = await connection.select().from(garmentStageRates).where(eq(garmentStageRates.garmentTypeId, garmentTypeId)).orderBy(desc(garmentStageRates.version));
  const result = Object.fromEntries(STAGES.map((stage) => [stage, rows.find((row) => row.stage === stage)]));
  if (STAGES.some((stage) => !result[stage])) throw new ApiError(422, "RATES_NOT_CONFIGURED", "এই পোশাকের ধাপভিত্তিক মজুরি আগে নির্ধারণ করুন");
  return result as Record<typeof STAGES[number], typeof garmentStageRates.$inferSelect>;
}
async function setRates(tx: Transaction, actor: Actor, id: string, value: unknown) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(422, "INVALID_RATES", "ধাপভিত্তিক মজুরি সঠিক নয়");
  const rates = value as Input;
  for (const stage of STAGES) {
    if (rates[stage] === undefined) throw new ApiError(422, "INVALID_RATES", "প্রতিটি ধাপের মজুরি দিন");
    const pieceRate = amount(rates[stage], "মজুরি");
    const [current] = await tx.select().from(garmentStageRates).where(sql`${garmentStageRates.garmentTypeId} = ${id} AND ${garmentStageRates.stage} = ${stage}`).orderBy(desc(garmentStageRates.version)).limit(1);
    if (current?.pieceRate === pieceRate) continue;
    await tx.insert(garmentStageRates).values({ garmentTypeId: id, stage, version: (current?.version ?? 0) + 1, pieceRate, createdByUserId: actor.userId });
  }
}
export async function listGarments(actor: Actor, options?: ListOptions) {
  authorize(actor, "admin");
  const p = page(options), filter = p.q ? or(ilike(garmentTypes.nameBn, "%" + p.q + "%"), ilike(garmentTypes.code, "%" + p.q + "%")) : undefined;
  const [rows, count] = await Promise.all([db.select().from(garmentTypes).where(filter).orderBy(asc(garmentTypes.sortOrder), asc(garmentTypes.nameBn)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(garmentTypes).where(filter)]);
  const rates = rows.length ? await db.select().from(garmentStageRates).where(inArray(garmentStageRates.garmentTypeId, rows.map((row) => row.id))).orderBy(desc(garmentStageRates.version)) : [];
  const enriched = rows.map((row) => ({ ...row, stageRates: Object.fromEntries(STAGES.map((stage) => [stage, rates.find((rate) => rate.garmentTypeId === row.id && rate.stage === stage)?.pieceRate ?? null])) }));
  return { rows: enriched, total: count[0].n, page: p.page, limit: p.limit };
}
export async function getGarment(actor: Actor, id: string) {
  authorize(actor, "admin");
  const row = present((await db.select().from(garmentTypes).where(eq(garmentTypes.id, uuid(id))).limit(1))[0], "পোশাক");
  const rates = await db.select().from(garmentStageRates).where(eq(garmentStageRates.garmentTypeId, id)).orderBy(desc(garmentStageRates.version));
  return { ...row, stageRates: Object.fromEntries(STAGES.map((stage) => [stage, rates.find((rate) => rate.stage === stage)?.pieceRate ?? null])) };
}
export async function createGarment(actor: Actor, input: Input) {
  authorize(actor, "management");
  const values = fields(input), measurement = schema(input.measurementSchema), style = styles(input.styleSchema);
  const id = await db.transaction(async (tx) => {
    const [created] = await tx.insert(garmentCatalog).values({ ...values, isActive: false }).returning({ id: garmentCatalog.id });
    const [revision] = await tx.insert(garmentSchemaVersions).values({ garmentTypeId: created.id, version: 1, measurementSchema: { ...measurement, version: 1 }, styleSchema: style, createdByUserId: actor.userId }).returning({ id: garmentSchemaVersions.id });
    await setRates(tx, actor, created.id, input.stageRates);
    if (values.isActive) await getCurrentStageRates(tx, created.id);
    await tx.update(garmentCatalog).set({ activeSchemaVersionId: revision.id, isActive: values.isActive }).where(eq(garmentCatalog.id, created.id));
    await recordAudit(tx, { actorId: actor.userId, action: "create", entity: "garment", entityId: created.id, details: { schemaVersion: 1 } });
    return created.id;
  });
  return getGarment(actor, id);
}
export async function updateGarment(actor: Actor, id: string, input: Input) {
  authorize(actor, "management");
  const garmentId = uuid(id);
  await db.transaction(async (tx) => {
    const current = present((await tx.select().from(garmentCatalog).where(eq(garmentCatalog.id, garmentId)).for("update"))[0], "পোশাক");
    const values = fields(input, current);
    let activeSchemaVersionId = current.activeSchemaVersionId;
    if ("measurementSchema" in input || "styleSchema" in input) {
      const existing = present((await tx.select().from(garmentSchemaVersions).where(eq(garmentSchemaVersions.id, current.activeSchemaVersionId!)).limit(1))[0], "মাপের স্কিমা");
      const measurement = schema(input.measurementSchema ?? existing.measurementSchema), style = styles(input.styleSchema ?? existing.styleSchema);
      const [latest] = await tx.select({ version: garmentSchemaVersions.version }).from(garmentSchemaVersions).where(eq(garmentSchemaVersions.garmentTypeId, garmentId)).orderBy(desc(garmentSchemaVersions.version)).limit(1);
      const version = latest.version + 1;
      const [revision] = await tx.insert(garmentSchemaVersions).values({ garmentTypeId: garmentId, version, measurementSchema: { ...measurement, version }, styleSchema: style, createdByUserId: actor.userId }).returning({ id: garmentSchemaVersions.id });
      activeSchemaVersionId = revision.id;
    }
    await setRates(tx, actor, garmentId, input.stageRates);
    if (values.isActive) await getCurrentStageRates(tx, garmentId);
    await tx.update(garmentCatalog).set({ ...values, activeSchemaVersionId, updatedAt: new Date() }).where(eq(garmentCatalog.id, garmentId));
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "garment", entityId: garmentId, details: { fields: changedFields(input), schemaVersionId: activeSchemaVersionId } });
  });
  return getGarment(actor, garmentId);
}
export async function archiveGarment(actor: Actor, id: string) {
  return updateGarment(actor, id, { isActive: false });
}
