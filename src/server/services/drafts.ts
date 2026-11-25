import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerAccounts, garmentCatalog, measurementProfiles, measurementSets, orderDraftAssignments, orderDraftItems, orderDrafts, workers } from "@/db/schema";
import { ApiError } from "@/lib/api-route";
import { money, numberValue, stringRecord, text } from "@/lib/api-input";
import { formatPhone } from "@/lib/format";
import { getCustomer } from "./customers";
import { authorize, uuid, type Actor, type Input } from "./ops-common";

function optionalId(value: unknown) {
  return value == null || value === "" ? null : uuid(value);
}

export async function getDraft(actor: Actor) {
  authorize(actor);
  const [record] = await db.select().from(orderDrafts).where(eq(orderDrafts.userId, actor.userId)).limit(1);
  if (!record) return { draft: null, updated_at: null };
  const [items, assignments, customer] = await Promise.all([
    db.select({ item: orderDraftItems, basePrice: garmentCatalog.basePrice }).from(orderDraftItems).innerJoin(garmentCatalog, eq(orderDraftItems.garmentTypeId, garmentCatalog.id)).where(eq(orderDraftItems.draftUserId, actor.userId)).orderBy(asc(orderDraftItems.position)),
    db.select().from(orderDraftAssignments).where(eq(orderDraftAssignments.draftUserId, actor.userId)),
    record.customerId ? getCustomer(actor, record.customerId) : null,
  ]);
  return { draft: { ...(record.payload as Input), customer: customer ? { ...customer, phone: formatPhone(customer.phone) } : null, profileId: record.profileId ?? "",
    lines: items.map(({ item, basePrice }) => ({ key: item.position + 1, garmentId: item.garmentTypeId, measurementSetId: item.measurementSetId, qty: item.quantity, price: Number(item.unitPrice ?? basePrice), fabricSource: item.fabricSource, fabricQty: item.fabricQty ?? "", notes: item.notes ?? "", styleOverrides: item.styleOverrides })),
    manualWorkers: Object.fromEntries(assignments.map((assignment) => [assignment.stage, assignment.workerId ?? "unassigned"])) }, updated_at: record.updatedAt.toISOString() };
}

export async function saveDraft(actor: Actor, value: unknown) {
  authorize(actor);
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > 128_000) throw new ApiError(422, "INVALID_DRAFT", "ড্রাফটের তথ্য সঠিক নয়");
  const input = value as Input;
  const cached = input.customer && typeof input.customer === "object" && !Array.isArray(input.customer) ? input.customer as Input : {};
  const customerId = optionalId(input.customerId ?? cached.id), profileId = optionalId(input.profileId);
  if (profileId && !customerId) throw new ApiError(422, "PROFILE_MISMATCH", "প্রোফাইলের কাস্টমার বাছুন");
  const payload: Input = {};
  for (const field of ["delivery", "discount", "advance", "notes", "priority", "assignmentMode", "method"]) if (input[field] !== undefined) payload[field] = text(input[field], "ড্রাফটের " + field, field === "notes" ? 2_000 : 100) ?? "";
  const rawLines = input.lines ?? [];
  if (!Array.isArray(rawLines) || rawLines.length > 100) throw new ApiError(422, "INVALID_DRAFT", "ড্রাফটের পোশাকের তালিকা সঠিক নয়");
  const lines = rawLines.map((value, position) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(422, "INVALID_DRAFT", "ড্রাফটের পোশাক সঠিক নয়");
    const line = value as Input;
    const quantity = numberValue(line.qty ?? line.quantity, "পোশাকের সংখ্যা", 1, 10_000, true);
    if (quantity < 1) throw new ApiError(422, "INVALID_DRAFT", "পোশাকের সংখ্যা অন্তত এক হতে হবে");
    const fabricSource = text(line.fabricSource ?? line.fabric_source, "কাপড়ের উৎস", 20) ?? "shop";
    if (!["shop", "customer"].includes(fabricSource)) throw new ApiError(422, "INVALID_DRAFT", "কাপড়ের উৎস সঠিক নয়");
    const rawQty = line.fabricQty ?? line.fabric_qty;
    const fabricQty = rawQty == null || rawQty === "" ? null : numberValue(typeof rawQty === "string" ? Number(rawQty) : rawQty, "কাপড়ের পরিমাণ", 0, 9_999.99).toFixed(2);
    const price = line.price ?? line.unit_price;
    return { draftUserId: actor.userId, position, garmentTypeId: uuid(line.garmentId ?? line.garment_type_id), measurementSetId: optionalId(line.measurementSetId ?? line.measurement_set_id), quantity,
      unitPrice: price === undefined ? null : (money(price, "মূল্য") / 100).toFixed(2), fabricSource, fabricQty, notes: text(line.notes ?? line.design_notes, "নোট") || null, styleOverrides: stringRecord(line.styleOverrides, "স্টাইল") };
  });
  const manual = stringRecord(input.manualWorkers, "কারিগর বণ্টন");
  const assignments = ["cutting", "stitching", "finishing"].filter((stage) => stage in manual).map((stage) => ({ draftUserId: actor.userId, stage, workerId: manual[stage] === "unassigned" || !manual[stage] ? null : uuid(manual[stage]) }));
  const updatedAt = new Date();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"order-draft:" + actor.userId}))`);
    if (customerId) {
      const [customer] = await tx.select({ id: customerAccounts.id }).from(customerAccounts).where(and(eq(customerAccounts.id, customerId), eq(customerAccounts.isActive, true))).limit(1);
      if (!customer) throw new ApiError(422, "CUSTOMER_ARCHIVED", "সক্রিয় কাস্টমার বাছুন");
    }
    if (profileId) {
      const [profile] = await tx.select({ id: measurementProfiles.id }).from(measurementProfiles).where(and(eq(measurementProfiles.id, profileId), eq(measurementProfiles.customerId, customerId!), eq(measurementProfiles.isActive, true))).limit(1);
      if (!profile) throw new ApiError(422, "PROFILE_MISMATCH", "প্রোফাইলটি এই কাস্টমারের নয়");
    }
    if (lines.length) {
      const ids = [...new Set(lines.map((line) => line.garmentTypeId))];
      const garments = await tx.select({ id: garmentCatalog.id }).from(garmentCatalog).where(and(inArray(garmentCatalog.id, ids), eq(garmentCatalog.isActive, true)));
      if (garments.length !== ids.length) throw new ApiError(422, "GARMENT_MISMATCH", "সক্রিয় পোশাকের ধরন বাছুন");
    }
    for (const line of lines) if (line.measurementSetId) {
      const [set] = await tx.select().from(measurementSets).where(eq(measurementSets.id, line.measurementSetId)).limit(1);
      if (!set || set.profileId !== profileId || set.garmentTypeId !== line.garmentTypeId) throw new ApiError(422, "SNAPSHOT_MISMATCH", "ড্রাফটের মাপ প্রোফাইল ও পোশাকের নয়");
    }
    for (const assignment of assignments) if (assignment.workerId) {
      const [worker] = await tx.select({ id: workers.id }).from(workers).where(and(eq(workers.id, assignment.workerId), eq(workers.role, assignment.stage), eq(workers.isActive, true))).limit(1);
      if (!worker) throw new ApiError(422, "WORKER_MISMATCH", "এই ধাপের উপযুক্ত কারিগর বাছুন");
    }
    await tx.insert(orderDrafts).values({ userId: actor.userId, customerId, profileId, payload, updatedAt }).onConflictDoUpdate({ target: orderDrafts.userId, set: { customerId, profileId, payload, updatedAt } });
    await tx.delete(orderDraftItems).where(eq(orderDraftItems.draftUserId, actor.userId));
    await tx.delete(orderDraftAssignments).where(eq(orderDraftAssignments.draftUserId, actor.userId));
    if (lines.length) await tx.insert(orderDraftItems).values(lines);
    if (assignments.length) await tx.insert(orderDraftAssignments).values(assignments);
  });
  return { ok: true, updated_at: updatedAt.toISOString() };
}

export async function deleteDraft(actor: Actor) {
  authorize(actor);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"order-draft:" + actor.userId}))`);
    await tx.delete(orderDrafts).where(eq(orderDrafts.userId, actor.userId));
  });
  return { ok: true };
}
