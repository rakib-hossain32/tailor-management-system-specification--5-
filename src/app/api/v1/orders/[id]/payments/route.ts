import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { adminRoute, ApiError, isUuid } from "@/lib/api-route";
import type { StaffSession } from "@/lib/access";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function recordPayment(req: Request, ctx: Context, staff: StaffSession) {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "অর্ডার নম্বর সঠিক নয়");
  let body: { amount?: number | string; method?: string; txnId?: string; senderNo?: string; kind?: string; idempotencyKey?: string };
  try { body = await req.json(); } catch { throw new ApiError(400, "VALIDATION_ERROR", "ভুল অনুরোধ"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "VALIDATION_ERROR", "ভুল অনুরোধ");
  if ((typeof body.amount !== "number" && typeof body.amount !== "string") ||
      (typeof body.amount === "string" && !/^(?:\d+|\d*\.\d{1,2})$/.test(body.amount.trim()))) {
    throw new ApiError(400, "VALIDATION_ERROR", "টাকার পরিমাণ সঠিক নয়");
  }
  const rawAmount = Number(body.amount);
  const amount = Math.round(rawAmount * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999.99 ||
      Math.abs(rawAmount * 100 - Math.round(rawAmount * 100)) > 0.000_01) {
    throw new ApiError(400, "VALIDATION_ERROR", "টাকার পরিমাণ সঠিক নয়");
  }
  const method = body.method ?? "cash";
  if (!["cash", "bkash", "nagad", "rocket", "card", "bank"].includes(method)) {
    throw new ApiError(400, "VALIDATION_ERROR", "পেমেন্টের মাধ্যম সঠিক নয়");
  }
  const kind = body.kind ?? "installment";
  if (!["advance", "installment", "final"].includes(kind)) throw new ApiError(400, "VALIDATION_ERROR", "পেমেন্টের ধরন সঠিক নয়");
  const key = body.idempotencyKey ?? null;
  if (key !== null && (typeof key !== "string" || !/^[\w:.-]{8,128}$/.test(key))) {
    throw new ApiError(400, "VALIDATION_ERROR", "পেমেন্ট অনুরোধের আইডি সঠিক নয়");
  }
  for (const text of [body.txnId, body.senderNo]) {
    if (text != null && (typeof text !== "string" || text.length > 256)) throw new ApiError(400, "VALIDATION_ERROR", "ট্রানজেকশন তথ্য সঠিক নয়");
  }
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!order) throw new ApiError(404, "NOT_FOUND", "অর্ডার পাওয়া যায়নি");
    if (key) {
      const [existing] = await tx.select().from(payments).where(and(eq(payments.orderId, id), eq(payments.idempotencyKey, key))).limit(1);
      if (existing) {
        if (Number(existing.amount) !== amount || existing.method !== method || existing.kind !== kind || existing.txnId !== (body.txnId || null) || existing.senderNo !== (body.senderNo || null)) {
          throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "একই অনুরোধের আইডিতে ভিন্ন পেমেন্ট পাঠানো হয়েছে");
        }
        return { payment: existing, order, duplicate: true };
      }
    }
    if (order.status === "cancelled") throw new ApiError(409, "ORDER_CANCELLED", "বাতিল অর্ডারে পেমেন্ট নেওয়া যায় না");
    const due = Math.round(Number(order.dueAmount) * 100);
    const amountCents = Math.round(amount * 100);
    if (amountCents > due) throw new ApiError(409, "OVERPAYMENT", "বকেয়ার চেয়ে বেশি টাকা নেওয়া যায় না");
    const [payment] = await tx.insert(payments).values({
      orderId: id, customerId: order.customerId, amount: amount.toFixed(2), method, kind,
      txnId: body.txnId || null, senderNo: body.senderNo || null, receivedBy: staff.name,
      receiptNo: "RC-" + new Date().getFullYear() + "-" + randomUUID().slice(0, 12).toUpperCase(),
      idempotencyKey: key,
    }).returning();
    const paid = Math.round(Number(order.paidAmount) * 100) + amountCents;
    const [updated] = await tx.update(orders).set({
      paidAmount: (paid / 100).toFixed(2), dueAmount: ((due - amountCents) / 100).toFixed(2), updatedAt: new Date(),
    }).where(eq(orders.id, id)).returning();
    return { payment, order: updated, duplicate: false };
  });
  return NextResponse.json({
    ok: true, duplicate: result.duplicate, receipt_no: result.payment.receiptNo,
    paid_amount: result.order.paidAmount, due_amount: result.order.dueAmount,
  });
}

async function listPayments(req: Request, ctx: Context) {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "অর্ডার নম্বর সঠিক নয়");
  const [order] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw new ApiError(404, "NOT_FOUND", "অর্ডার পাওয়া যায়নি");
  const customerId = new URL(req.url).searchParams.get("customer_id");
  if (customerId && (!isUuid(customerId) || customerId !== order.customerId)) throw new ApiError(404, "NOT_FOUND", "অর্ডার পাওয়া যায়নি");
  const rows = await db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.receivedAt)).limit(200);
  return NextResponse.json({ payments: rows });
}

export const POST = adminRoute(recordPayment);
export const GET = adminRoute(listPayments);
