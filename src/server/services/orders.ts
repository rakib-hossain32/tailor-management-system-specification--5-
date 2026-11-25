import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, garmentTypes, measurementProfiles, measurementSets, orderItems, orderEvents, orderRecords, orderStatusHistory, orders, paymentEntries, payments, tasks, taskRecords, workers } from "@/db/schema";
import { ApiError, isUuid } from "@/lib/api-route";
import { MAX_MONEY, money, numberValue, stringRecord, text } from "@/lib/api-input";
import { dhakaDate, isCalendarDate } from "@/lib/appointments";

import "server-only";
import { viewFields } from "@/server/repositories/views";
import { recordAudit } from "@/server/audit";
import { canTransition, statusMeta } from "@/lib/order-status";
import { getCurrentStageRates } from "./garments";
import { authorize, bool, changedFields, page, present, searchTerms, uuid, type Actor, type Input, type ListOptions } from "./ops-common";
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
export async function createOrder(staff: Actor, body: Input) {
  authorize(staff);
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
    const [customer] = await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.id, customerId), eq(customers.isActive, true))).limit(1);
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
        const [profile] = await tx.select({ id: measurementProfiles.id }).from(measurementProfiles).where(and(eq(measurementProfiles.id, profileId), eq(measurementProfiles.customerId, customerId), eq(measurementProfiles.isActive, true))).limit(1);
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
    const [order] = await tx.insert(orderRecords).values({ orderNo, customerId, type, status: "confirmed", priority, orderDate, trialDate, deliveryDate,
      discount: (discountCents / 100).toFixed(2),
      source, notes, updatedAt: new Date() }).returning();
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
      const rates = await getCurrentStageRates(tx, item.garmentId);
      for (const stage of STAGES) {
        const workerId = assignmentMode === "auto" ? pickWorker(stage) : assignmentMode === "manual" && manualWorkers[stage] && manualWorkers[stage] !== "unassigned" ? manualWorkers[stage] : null;
        await tx.insert(taskRecords).values({ orderItemId: createdItem.id, rateVersionId: rates[stage].id, workerId, status: "assigned" });
      }
    }
    const historyNote = assignmentMode === "auto" ? "নতুন অর্ডার তৈরি · স্বয়ংক্রিয় কারিগর বণ্টন" : assignmentMode === "manual" ? "নতুন অর্ডার তৈরি · ম্যানুয়াল কারিগর বণ্টন" : "নতুন অর্ডার তৈরি · কারিগর বণ্টন পরে করা হবে";
    await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: null, toStatus: "confirmed", note: historyNote, actorId: staff.userId });
    const receipt = advanceCents > 0 ? `RC-${randomUUID().slice(0, 8).toUpperCase()}` : null;
    if (advanceCents > 0) await tx.insert(paymentEntries).values({ orderId: order.id, amount: (advanceCents / 100).toFixed(2), method: paymentMethod, kind: "advance", receivedByUserId: staff.userId, receiptNo: receipt });
    const [dueCount] = await tx.select({ n: sql<number>`count(*)::int` }).from(orders).where(sql`${orders.deliveryDate} = ${deliveryDate} AND ${orders.status} not in ('delivered','cancelled')`);
    await recordAudit(tx, { actorId: staff.userId, action: "create", entity: "order", entityId: order.id, details: { itemCount: resolved.length, assignmentMode } });
    return { id: order.id, orderNo, receipt, dueThatDay: dueCount.n };
  });
  const warnings = result.dueThatDay > 6 ? [`${result.dueThatDay}টি অর্ডার একই দিনে ডেলিভারির জন্য আছে — চাপ বেশি হতে পারে।`] : [];
  return { id: result.id, order_no: result.orderNo, receipt_no: result.receipt, warnings };
}

export async function listOrders(actor: Actor, options: ListOptions & { customerId?: string; status?: string } = {}) {
  authorize(actor);
  const p = page(options);
  const filter = and(options.customerId ? eq(orders.customerId, uuid(options.customerId)) : undefined, options.status ? eq(orders.status, text(options.status, "স্ট্যাটাস", 30) ?? "") : undefined,
    p.q ? sql`(${orders.orderNo} ilike ${"%" + searchTerms(p.q).normalized + "%"} or ${customers.name} ilike ${"%" + p.q + "%"} or ${customers.phone} ilike ${"%" + searchTerms(p.q).normalized + "%"})` : undefined);
  const [rows, count] = await Promise.all([db.select({ o: viewFields(orders), customer: customers.name }).from(orders).innerJoin(customers, eq(orders.customerId, customers.id)).where(filter).orderBy(desc(orders.createdAt)).limit(p.limit).offset(p.offset),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).innerJoin(customers, eq(orders.customerId, customers.id)).where(filter)]);
  return { rows, total: count[0].n, page: p.page, limit: p.limit };
}

export async function getOrder(actor: Actor, id: string) {
  authorize(actor);
  const orderId = uuid(id);
  const order = present((await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0], "অর্ডার");
  const [customer, items, ledger, history, work] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1),
    db.select({ item: getTableColumns(orderItems), garmentName: garmentTypes.nameBn }).from(orderItems).innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id)).where(eq(orderItems.orderId, orderId)),
    db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.receivedAt)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId)).orderBy(asc(orderStatusHistory.changedAt)),
    db.select({ task: viewFields(tasks) }).from(tasks).innerJoin(orderItems, eq(tasks.orderItemId, orderItems.id)).where(eq(orderItems.orderId, orderId)),
  ]);
  return { ...order, customer: customer[0], items: items.map((row) => ({ ...row.item, garmentName: row.garmentName })), payments: ledger, history, tasks: work.map((row) => row.task) };
}

/** Update mutable header terms; recorded item prices and observations stay historical. */
export async function updateOrder(actor: Actor, id: string, input: Input) {
  authorize(actor);
  const orderId = uuid(id);
  if (["subtotal", "total", "paidAmount", "paid_amount", "dueAmount", "due_amount"].some((field) => field in input)) throw new ApiError(422, "DERIVED_FIELD", "মোট ও বকেয়া লাইন আইটেম এবং পেমেন্ট থেকে হিসাব হয়");
  if ("status" in input || "to" in input) throw new ApiError(422, "USE_STATUS_ENDPOINT", "স্ট্যাটাস পরিবর্তনের নির্দিষ্ট অনুরোধ ব্যবহার করুন");
  if ("items" in input) throw new ApiError(409, "QUOTE_IMMUTABLE", "রেকর্ড করা পোশাক ও মূল্য বদলাতে অর্ডার বাতিল করে সংশোধিত অর্ডার তৈরি করুন");
  if ("discount" in input) authorize(actor, "management");
  await db.transaction(async (tx) => {
    const current = present((await tx.select().from(orderRecords).where(eq(orderRecords.id, orderId)).for("update"))[0], "অর্ডার");
    if (["delivered", "cancelled"].includes(current.status)) throw new ApiError(409, "ORDER_CLOSED", "সম্পন্ন বা বাতিল অর্ডারের শিরোনাম বদলানো যায় না");
    if ((input.customer_id !== undefined && input.customer_id !== current.customerId) || (input.customerId !== undefined && input.customerId !== current.customerId)) throw new ApiError(422, "IMMUTABLE_RELATION", "অর্ডারের কাস্টমার বদলানো যায় না");
    const deliveryDate = input.delivery_date ?? input.deliveryDate ?? current.deliveryDate;
    const trialDate = "trial_date" in input ? input.trial_date : "trialDate" in input ? input.trialDate : current.trialDate;
    if (!isCalendarDate(deliveryDate) || deliveryDate < current.orderDate || (trialDate != null && trialDate !== "" && (!isCalendarDate(trialDate) || trialDate < current.orderDate || trialDate > deliveryDate))) throw new ApiError(422, "VALIDATION_ERROR", "ট্রায়াল ও ডেলিভারির তারিখ সঠিকভাবে দিন");
    const discount = input.discount === undefined ? current.discount : (money(input.discount, "ছাড়") / 100).toFixed(2);
    const [summary] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (Number(discount) > Number(summary.subtotal) || Number(summary.subtotal) - Number(discount) < Number(summary.paidAmount)) throw new ApiError(409, "INVALID_TOTAL", "ছাড়ের পর মোট মূল্য গ্রহণ করা পেমেন্টের নিচে হতে পারে না");
    if (input.discount !== undefined && !["draft", "requested", "confirmed"].includes(current.status)) throw new ApiError(409, "QUOTE_IMMUTABLE", "কাজ শুরু হওয়ার পরে সম্মত ছাড় বদলানো যায় না");
    const priority = text(input.priority, "অগ্রাধিকার", 20) ?? current.priority;
    if (!["normal", "urgent"].includes(priority)) throw new ApiError(422, "VALIDATION_ERROR", "অগ্রাধিকার সঠিক নয়");
    await tx.update(orderRecords).set({ deliveryDate, trialDate: trialDate === "" ? null : trialDate as string | null, discount, priority, notes: "notes" in input ? text(input.notes, "নোট") || null : current.notes, updatedAt: new Date() }).where(eq(orderRecords.id, orderId));
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "order", entityId: orderId, details: { fields: changedFields(input), ...(input.discount !== undefined ? { previousDiscount: current.discount, discount } : {}) } });
  });
  return getOrder(actor, orderId);
}

export async function changeOrderStatus(actor: Actor, id: string, input: Input) {
  authorize(actor);
  const orderId = uuid(id), to = text(input.to ?? input.status, "স্ট্যাটাস", 30) ?? "", override = bool(input.override_due, false);
  const note = text(input.note, "নোট") || null, reason = text(input.override_reason, "কারণ", 1000) || null;
  if (!to) throw new ApiError(422, "VALIDATION_ERROR", "নতুন স্ট্যাটাস দিন");
  if (override) authorize(actor, "management");
  await db.transaction(async (tx) => {
    const current = present((await tx.select().from(orderRecords).where(eq(orderRecords.id, orderId)).for("update"))[0], "অর্ডার");
    const [summary] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (current.status === to) throw new ApiError(409, "STATE_ERROR", "অর্ডার ইতিমধ্যে এই স্ট্যাটাসে আছে");
    if (!canTransition(current.status, to)) throw new ApiError(422, "STATE_ERROR", `${statusMeta(current.status).labelBn} থেকে ${statusMeta(to).labelBn} যাওয়া যায় না`);
    if (to === "delivered" && Number(summary.dueAmount) > 0 && !override) throw new ApiError(409, "DUE_REQUIRED", "বকেয়া পরিশোধ ছাড়া ডেলিভারি দেওয়া যায় না");
    if (to === "delivered" && Number(summary.dueAmount) > 0 && (!reason || reason.length < 4)) throw new ApiError(422, "OVERRIDE_REASON_REQUIRED", "বকেয়া সহ ডেলিভারির কারণ দিন");
    if (to === "cancelled" && Number(summary.paidAmount) > 0) throw new ApiError(409, "REFUND_REQUIRED", "অর্ডার বাতিল করার আগে পেমেন্ট ফেরত বা রিভার্স করুন");
    await tx.update(orderRecords).set({ status: to, cancelledReason: to === "cancelled" ? note || "প্রশাসনিকভাবে বাতিল" : current.cancelledReason, updatedAt: new Date() }).where(eq(orderRecords.id, orderId));
    await tx.update(orderItems).set({ status: to, updatedAt: new Date() }).where(eq(orderItems.orderId, orderId));
    if (to === "cancelled") {
      const items = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId));
      if (items.length) await tx.update(taskRecords).set({ status: "cancelled", updatedAt: new Date() }).where(and(inArray(taskRecords.orderItemId, items.map((item) => item.id)), inArray(taskRecords.status, ["assigned", "in_progress", "rework"])));
    }
    await tx.insert(orderEvents).values({ orderId, fromStatus: current.status, toStatus: to, note: note ?? (to === "delivered" && override ? `বকেয়া সহ ডেলিভারি: ${reason}` : null), actorId: actor.userId });
    await recordAudit(tx, { actorId: actor.userId, action: "status", entity: "order", entityId: orderId, details: { from: current.status, to, override, reason } });
  });
  return { ok: true, status: to };
}

export async function cancelOrder(actor: Actor, id: string, reason?: string) {
  return changeOrderStatus(actor, id, { to: "cancelled", note: reason || "প্রশাসনিকভাবে বাতিল" });
}
