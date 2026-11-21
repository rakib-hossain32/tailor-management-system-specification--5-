import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, garmentTypes, measurementProfiles, measurementSets, orderItems, orderStatusHistory, orders, payments, tasks, workers } from "@/db/schema";
import { adminRoute, ApiError, isUuid } from "@/lib/api-route";
import { jsonObject, MAX_MONEY, money, numberValue, stringRecord, text } from "@/lib/api-input";
import { dhakaDate, isCalendarDate } from "@/lib/appointments";

export const dynamic = "force-dynamic";
const STAGES = ["cutting", "stitching", "finishing"] as const;
type Stage = (typeof STAGES)[number];
type Item = { garmentId: string; profileId: string | null; setId: string | null; quantity: number; priceCents: number | null; fabricSource: string; fabricQty: string | null; notes: string | null; styles: Record<string, string> };

function optionalUuid(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (!isUuid(value)) throw new ApiError(400, "VALIDATION_ERROR", `${label} সঠিক নয়`);
  return value;
}

function parseItem(value: unknown): Item {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "VALIDATION_ERROR", "পোশাকের তথ্য সঠিক নয়");
  const item = value as Record<string, unknown>;
  const garmentId = item.garment_type_id;
  if (!isUuid(garmentId)) throw new ApiError(400, "VALIDATION_ERROR", "পোশাকের ধরন সঠিকভাবে বাছুন");
  const quantity = numberValue(item.quantity, "পোশাকের সংখ্যা", 1, 10_000, true);
  if (quantity < 1) throw new ApiError(422, "VALIDATION_ERROR", "পোশাকের সংখ্যা অন্তত এক হতে হবে");
  const fabricSource = text(item.fabric_source, "কাপড়ের উৎস", 20) ?? "shop";
  if (!["shop", "customer"].includes(fabricSource)) throw new ApiError(400, "VALIDATION_ERROR", "কাপড়ের উৎস সঠিকভাবে বাছুন");
  let fabricQty: string | null = null;
  if (item.fabric_qty != null) {
    const value = typeof item.fabric_qty === "string" && item.fabric_qty.trim() !== "" ? Number(item.fabric_qty) : item.fabric_qty;
    fabricQty = numberValue(value, "কাপড়ের পরিমাণ", 0, 9_999.99).toFixed(2);
  }
  return { garmentId, profileId: optionalUuid(item.profile_id, "মাপ প্রোফাইল"), setId: optionalUuid(item.measurement_set_id, "মাপের পরিচয়"), quantity,
    priceCents: item.unit_price === undefined ? null : money(item.unit_price, "পোশাকের মূল্য"), fabricSource, fabricQty,
    notes: text(item.design_notes, "ডিজাইনের নোট") || null, styles: stringRecord(item.style_overrides, "পোশাকের স্টাইল") };
}

/** Create one atomic order with owned immutable snapshots and consistent money. */
export const POST = adminRoute(async (req, _ctx, staff) => {
  const body = await jsonObject(req);
  const customerId = body.customer_id;
  if (!isUuid(customerId)) throw new ApiError(400, "VALIDATION_ERROR", "কাস্টমার সঠিকভাবে বেছে নিন");
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) throw new ApiError(400, "VALIDATION_ERROR", "এক থেকে একশটি পোশাক যোগ করুন");
  const items = body.items.map(parseItem);
  const orderDate = body.order_date === undefined ? dhakaDate() : body.order_date;
  const deliveryDate = body.delivery_date;
  const trialDate = body.trial_date == null || body.trial_date === "" ? null : body.trial_date;
  if (!isCalendarDate(orderDate) || !isCalendarDate(deliveryDate) || deliveryDate < orderDate || (trialDate !== null && (!isCalendarDate(trialDate) || trialDate < orderDate || trialDate > deliveryDate))) {
    throw new ApiError(400, "VALIDATION_ERROR", "অর্ডার, ট্রায়াল ও ডেলিভারির তারিখ সঠিক ক্রমে দিন");
  }
  const type = text(body.type, "অর্ডারের ধরন", 20) ?? "new";
  const priority = text(body.priority, "অগ্রাধিকার", 20) ?? "normal";
  const source = text(body.source, "অর্ডারের উৎস", 20) ?? "walk_in";
  const assignmentMode = text(body.assignment_mode, "কারিগর বণ্টন", 20) ?? "auto";
  if (!["new", "alteration", "repair", "bulk"].includes(type) || !["normal", "urgent"].includes(priority) || !["walk_in", "online", "phone", "appointment"].includes(source) || !["auto", "manual", "unassigned"].includes(assignmentMode)) {
    throw new ApiError(400, "VALIDATION_ERROR", "অর্ডারের ধরন, উৎস বা কারিগর বণ্টন সঠিকভাবে বাছুন");
  }
  const manualWorkers = stringRecord(body.manual_workers, "কারিগর বণ্টন");
  for (const stage of STAGES) if (manualWorkers[stage] && manualWorkers[stage] !== "unassigned" && !isUuid(manualWorkers[stage])) throw new ApiError(400, "VALIDATION_ERROR", "কারিগরের পরিচয় সঠিক নয়");
  if (body.payment !== undefined && (!body.payment || typeof body.payment !== "object" || Array.isArray(body.payment))) throw new ApiError(400, "VALIDATION_ERROR", "অগ্রিমের তথ্য সঠিক নয়");
  const payment = (body.payment ?? {}) as Record<string, unknown>;
  const discountCents = money(body.discount, "ছাড়");
  const advanceCents = money(payment.amount, "অগ্রিম");
  const paymentMethod = text(payment.method, "পেমেন্টের মাধ্যম", 20) ?? "cash";
  if (!["cash", "bkash", "nagad", "rocket", "card", "bank"].includes(paymentMethod)) throw new ApiError(400, "VALIDATION_ERROR", "পেমেন্টের মাধ্যম সঠিকভাবে বাছুন");
  const notes = text(body.notes, "অর্ডারের নোট") || null;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('tailorpro_order_no'))`);
    const [customer] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!customer) throw new ApiError(404, "NOT_FOUND", "কাস্টমার পাওয়া যায়নি");
    const garments = await tx.select({ id: garmentTypes.id, price: garmentTypes.basePrice, code: garmentTypes.code }).from(garmentTypes)
      .where(and(inArray(garmentTypes.id, [...new Set(items.map((item) => item.garmentId))]), eq(garmentTypes.isActive, true)));
    const garmentMap = new Map(garments.map((garment) => [garment.id, garment]));
    const resolved: (Item & { priceCents: number; code: string })[] = [];
    let subtotalCents = 0;
    for (const item of items) {
      const garment = garmentMap.get(item.garmentId);
      if (!garment) throw new ApiError(404, "NOT_FOUND", "সক্রিয় পোশাকের ধরন পাওয়া যায়নি");
      let profileId = item.profileId;
      let setId = item.setId;
      if (setId) {
        const [snapshot] = await tx.select().from(measurementSets).where(eq(measurementSets.id, setId)).limit(1);
        if (!snapshot || snapshot.garmentTypeId !== item.garmentId || (profileId && snapshot.profileId !== profileId)) throw new ApiError(422, "SNAPSHOT_MISMATCH", "মাপটি নির্বাচিত প্রোফাইল ও পোশাকের নয়");
        profileId = snapshot.profileId;
      }
      if (profileId) {
        const [profile] = await tx.select({ id: measurementProfiles.id }).from(measurementProfiles).where(and(eq(measurementProfiles.id, profileId), eq(measurementProfiles.customerId, customerId))).limit(1);
        if (!profile) throw new ApiError(422, "PROFILE_MISMATCH", "মাপ প্রোফাইলটি নির্বাচিত কাস্টমারের নয়");
        if (!setId) {
          const [current] = await tx.select({ id: measurementSets.id }).from(measurementSets)
            .where(and(eq(measurementSets.profileId, profileId), eq(measurementSets.garmentTypeId, item.garmentId), eq(measurementSets.isCurrent, true))).orderBy(desc(measurementSets.version)).limit(1);
          setId = current?.id ?? null;
        }
      }
      const priceCents = item.priceCents ?? money(Number(garment.price), "পোশাকের মূল্য");
      subtotalCents += priceCents * item.quantity;
      if (!Number.isSafeInteger(subtotalCents) || subtotalCents > Math.round(MAX_MONEY * 100)) throw new ApiError(422, "VALIDATION_ERROR", "অর্ডারের মোট মূল্য সীমার বাইরে");
      resolved.push({ ...item, profileId, setId, priceCents, code: garment.code });
    }
    if (discountCents > subtotalCents) throw new ApiError(422, "VALIDATION_ERROR", "ছাড় মোট মূল্যের বেশি হতে পারে না");
    const totalCents = subtotalCents - discountCents;
    if (advanceCents > totalCents) throw new ApiError(422, "VALIDATION_ERROR", "অগ্রিম অর্ডারের মোট মূল্যের বেশি হতে পারে না");
    const activeWorkers = await tx.select({ id: workers.id, name: workers.name, role: workers.role }).from(workers).where(eq(workers.isActive, true)).orderBy(asc(workers.name));
    if (assignmentMode === "manual") for (const stage of STAGES) {
      const id = manualWorkers[stage];
      if (id && id !== "unassigned" && !activeWorkers.some((worker) => worker.id === id && worker.role === stage)) throw new ApiError(422, "WORKER_MISMATCH", "এই ধাপের জন্য সক্রিয় উপযুক্ত কারিগর বাছুন");
    }
    const prefix = `TP-${orderDate.slice(2, 4)}${orderDate.slice(5, 7)}`;
    const existing = await tx.select({ orderNo: orders.orderNo }).from(orders).where(sql`${orders.orderNo} LIKE ${prefix + '-%'}`);
    const nextSeq = existing.reduce((max, row) => { const value = Number(row.orderNo.split("-")[2]); return Number.isSafeInteger(value) && value > max ? value : max; }, 0) + 1;
    const orderNo = `${prefix}-${String(nextSeq).padStart(4, "0")}`;
    const [order] = await tx.insert(orders).values({ orderNo, customerId, type, status: "confirmed", priority, orderDate, trialDate, deliveryDate,
      subtotal: (subtotalCents / 100).toFixed(2), discount: (discountCents / 100).toFixed(2), total: (totalCents / 100).toFixed(2),
      paidAmount: (advanceCents / 100).toFixed(2), dueAmount: ((totalCents - advanceCents) / 100).toFixed(2), source, notes, updatedAt: new Date() }).returning();
    const openTasks = await tx.select({ workerId: tasks.workerId }).from(tasks).where(inArray(tasks.status, ["assigned", "in_progress", "rework"]));
    const loads = new Map(activeWorkers.map((worker) => [worker.id, 0]));
    for (const task of openTasks) if (task.workerId && loads.has(task.workerId)) loads.set(task.workerId, (loads.get(task.workerId) ?? 0) + 1);
    const pickWorker = (stage: Stage): string | null => {
      const candidates = activeWorkers.filter((worker) => worker.role === stage).sort((a, b) => (loads.get(a.id) ?? 0) - (loads.get(b.id) ?? 0));
      const chosen = candidates[0];
      if (!chosen) return null;
      loads.set(chosen.id, (loads.get(chosen.id) ?? 0) + 1);
      return chosen.id;
    };
    for (const item of resolved) {
      const [createdItem] = await tx.insert(orderItems).values({ orderId: order.id, garmentTypeId: item.garmentId, profileId: item.profileId, measurementSetId: item.setId, styleOverrides: item.styles, fabricSource: item.fabricSource,
        fabricQty: item.fabricQty, quantity: item.quantity, unitPrice: (item.priceCents / 100).toFixed(2), designNotes: item.notes, status: "confirmed", updatedAt: new Date() }).returning();
      const rates: Record<Stage, string> = { cutting: item.code === "kameez" ? "90.00" : item.code === "panjabi" ? "80.00" : "60.00", stitching: item.code === "kameez" ? "320.00" : item.code === "panjabi" ? "220.00" : "160.00", finishing: item.code === "kameez" ? "110.00" : item.code === "panjabi" ? "90.00" : "70.00" };
      for (const stage of STAGES) {
        const workerId = assignmentMode === "auto" ? pickWorker(stage) : assignmentMode === "manual" && manualWorkers[stage] && manualWorkers[stage] !== "unassigned" ? manualWorkers[stage] : null;
        await tx.insert(tasks).values({ orderItemId: createdItem.id, stage, workerId, status: "assigned", pieceRate: rates[stage] });
      }
    }
    const historyNote = assignmentMode === "auto" ? "নতুন অর্ডার তৈরি · স্বয়ংক্রিয় কারিগর বণ্টন" : assignmentMode === "manual" ? "নতুন অর্ডার তৈরি · ম্যানুয়াল কারিগর বণ্টন" : "নতুন অর্ডার তৈরি · কারিগর বণ্টন পরে করা হবে";
    await tx.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: null, toStatus: "confirmed", note: historyNote, changedBy: staff.name });
    const receipt = advanceCents > 0 ? `RC-${randomUUID().slice(0, 8).toUpperCase()}` : null;
    if (advanceCents > 0) await tx.insert(payments).values({ orderId: order.id, customerId, amount: (advanceCents / 100).toFixed(2), method: paymentMethod, kind: "advance", receivedBy: staff.name, receiptNo: receipt });
    const [dueCount] = await tx.select({ n: sql<number>`count(*)::int` }).from(orders).where(sql`${orders.deliveryDate} = ${deliveryDate} AND ${orders.status} not in ('delivered','cancelled')`);
    return { id: order.id, orderNo, receipt, dueThatDay: dueCount.n };
  });
  const warnings = result.dueThatDay > 6 ? [`${result.dueThatDay}টি অর্ডার একই দিনে ডেলিভারির জন্য আছে — চাপ বেশি হতে পারে।`] : [];
  return NextResponse.json({ id: result.id, order_no: result.orderNo, receipt_no: result.receipt, warnings }, { status: 201 });
});

/** Authenticated lightweight listing. */
export const GET = adminRoute(async (req) => {
  const customerId = new URL(req.url).searchParams.get("customer_id");
  if (customerId !== null && !isUuid(customerId)) throw new ApiError(400, "VALIDATION_ERROR", "কাস্টমারের পরিচয় সঠিক নয়");
  const rows = await db.select({ o: orders, customer: customers.name }).from(orders).innerJoin(customers, eq(orders.customerId, customers.id))
    .where(customerId ? eq(orders.customerId, customerId) : undefined).orderBy(asc(orders.orderNo)).limit(100);
  return NextResponse.json({ orders: rows });
});
