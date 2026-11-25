import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orderRecords, orders, paymentEntries, payments } from "@/db/schema";
import { ApiError } from "@/lib/api-route";
import { money, text } from "@/lib/api-input";
import { dhakaDate } from "@/lib/appointments";
import { recordAudit } from "@/server/audit";
import { viewFields } from "@/server/repositories/views";
import { authorize, choice, page, present, searchTerms, uuid, type Actor, type Input, type ListOptions } from "./ops-common";

function keyValue(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string" || !/^[\w:.-]{8,128}$/.test(value)) throw new ApiError(422, "VALIDATION_ERROR", "পেমেন্ট অনুরোধের আইডি সঠিক নয়");
  return value;
}

function paymentAmount(value: unknown) {
  if (typeof value === "string") {
    if (!/^(?:\d+|\d*\.\d{1,2})$/.test(value.trim())) throw new ApiError(422, "VALIDATION_ERROR", "টাকার পরিমাণ সঠিক নয়");
    value = Number(value);
  }
  const cents = money(value, "টাকার পরিমাণ");
  if (cents <= 0) throw new ApiError(422, "VALIDATION_ERROR", "টাকার পরিমাণ শূন্যের বেশি হতে হবে");
  return cents;
}

export async function listPayments(actor: Actor, orderId: string, customerId?: string) {
  authorize(actor);
  const order = present((await db.select({ customerId: orderRecords.customerId }).from(orderRecords).where(eq(orderRecords.id, uuid(orderId))).limit(1))[0], "অর্ডার");
  if (customerId && uuid(customerId) !== order.customerId) throw new ApiError(404, "NOT_FOUND", "অর্ডার পাওয়া যায়নি");
  return db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.receivedAt)).limit(200);
}

export async function listPaymentRecords(actor: Actor, options: ListOptions & { orderId?: string; customerId?: string } = {}) {
  authorize(actor);
  const p = page(options);
  const filter = and(options.orderId ? eq(payments.orderId, uuid(options.orderId)) : undefined, options.customerId ? eq(payments.customerId, uuid(options.customerId)) : undefined,
    p.q ? or(ilike(payments.receiptNo, "%" + searchTerms(p.q).normalized + "%"), ilike(orders.orderNo, "%" + searchTerms(p.q).normalized + "%"), ilike(customers.name, "%" + p.q + "%")) : undefined);
  const [rows, count] = await Promise.all([
    db.select({ payment: viewFields(payments), orderNo: orders.orderNo, customerName: customers.name }).from(payments).innerJoin(orders, eq(payments.orderId, orders.id)).innerJoin(customers, eq(payments.customerId, customers.id)).where(filter).orderBy(desc(payments.receivedAt)).limit(p.limit).offset(p.offset),
    db.select({ n: sql<number>`count(*)::int` }).from(payments).innerJoin(orders, eq(payments.orderId, orders.id)).innerJoin(customers, eq(payments.customerId, customers.id)).where(filter),
  ]);
  return { rows: rows.map((row) => ({ ...row.payment, orderNo: row.orderNo, customerName: row.customerName })), total: count[0].n, page: p.page, limit: p.limit };
}

export async function getPayment(actor: Actor, id: string) {
  authorize(actor);
  return present((await db.select().from(payments).where(eq(payments.id, uuid(id))).limit(1))[0], "পেমেন্ট");
}

export async function recordPayment(actor: Actor, orderId: string, input: Input) {
  authorize(actor);
  const id = uuid(orderId), cents = paymentAmount(input.amount), amount = (cents / 100).toFixed(2);
  const method = choice(input.method, ["cash", "bkash", "nagad", "rocket", "card", "bank"], "পেমেন্টের মাধ্যম", "cash");
  const kind = choice(input.kind, ["advance", "installment", "final"], "পেমেন্টের ধরন", "installment");
  const key = keyValue(input.idempotencyKey ?? input.idempotency_key);
  const txnId = text(input.txnId, "ট্রানজেকশন আইডি", 256) || null, senderNo = text(input.senderNo, "প্রেরকের নম্বর", 40) || null;
  return db.transaction(async (tx) => {
    const header = present((await tx.select().from(orderRecords).where(eq(orderRecords.id, id)).for("update"))[0], "অর্ডার");
    const [before] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (key) {
      const [existing] = await tx.select().from(paymentEntries).where(and(eq(paymentEntries.orderId, id), eq(paymentEntries.idempotencyKey, key))).limit(1);
      if (existing) {
        if (existing.amount !== amount || existing.method !== method || existing.kind !== kind || existing.txnId !== txnId || existing.senderNo !== senderNo) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "একই আইডিতে ভিন্ন পেমেন্ট পাঠানো হয়েছে");
        return { ok: true, duplicate: true, receipt_no: existing.receiptNo, paid_amount: before.paidAmount, due_amount: before.dueAmount };
      }
    }
    if (header.status === "cancelled") throw new ApiError(409, "ORDER_CANCELLED", "বাতিল অর্ডারে পেমেন্ট নেওয়া যায় না");
    if (cents > Math.round(Number(before.dueAmount) * 100)) throw new ApiError(409, "OVERPAYMENT", "বকেয়ার চেয়ে বেশি টাকা নেওয়া যায় না");
    const [entry] = await tx.insert(paymentEntries).values({ orderId: id, amount, method, kind, txnId, senderNo, receivedByUserId: actor.userId,
      receiptNo: "RC-" + dhakaDate().slice(0, 4) + "-" + randomUUID().slice(0, 12).toUpperCase(), idempotencyKey: key }).returning();
    await recordAudit(tx, { actorId: actor.userId, action: "record", entity: "payment", entityId: entry.id, details: { orderId: id } });
    const [after] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1);
    return { ok: true, duplicate: false, receipt_no: entry.receiptNo, paid_amount: after.paidAmount, due_amount: after.dueAmount };
  });
}

/** Append one compensating event; the original financial entry is never removed. */
export async function reversePayment(actor: Actor, orderId: string, paymentId: string, input: Input) {
  authorize(actor, "management");
  const id = uuid(orderId), originalId = uuid(paymentId), reason = text(input.reason, "রিভার্সের কারণ", 1000) ?? "";
  if (reason.length < 4) throw new ApiError(422, "REASON_REQUIRED", "পেমেন্ট রিভার্সের কারণ লিখুন");
  return db.transaction(async (tx) => {
    present((await tx.select({ id: orderRecords.id }).from(orderRecords).where(eq(orderRecords.id, id)).for("update"))[0], "অর্ডার");
    const original = present((await tx.select().from(paymentEntries).where(and(eq(paymentEntries.id, originalId), eq(paymentEntries.orderId, id))).for("update"))[0], "পেমেন্ট");
    if (original.reversalOfId) throw new ApiError(409, "INVALID_REVERSAL", "রিভার্স করা পেমেন্ট আবার রিভার্স করা যায় না");
    const [existing] = await tx.select().from(paymentEntries).where(eq(paymentEntries.reversalOfId, originalId)).limit(1);
    let reversal = existing;
    if (!reversal) {
      [reversal] = await tx.insert(paymentEntries).values({ orderId: id, amount: original.amount, method: original.method, kind: "refund", reversalOfId: originalId, receivedByUserId: actor.userId,
        receiptNo: "RV-" + randomUUID().slice(0, 12).toUpperCase(), idempotencyKey: keyValue(input.idempotencyKey ?? input.idempotency_key) }).returning();
      await recordAudit(tx, { actorId: actor.userId, action: "reverse", entity: "payment", entityId: reversal.id, details: { orderId: id, originalId, reason } });
    }
    const [summary] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1);
    return { ok: true, duplicate: Boolean(existing), reversal_id: reversal.id, paid_amount: summary.paidAmount, due_amount: summary.dueAmount };
  });
}
