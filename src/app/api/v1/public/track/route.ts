import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { statusMeta, publicProgress, PUBLIC_STEPS } from "@/lib/order-status";
import { formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Public order tracking — deliberately minimal disclosure (PRD 11.4).
 * Never returns measurements, addresses, phone numbers or worker data.
 * Rate limited: 10 attempts / minute / IP+phone.
 */
const hits: Map<string, { count: number; reset: number }> = new Map();

function limited(key: string): boolean {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || rec.reset < now) {
    hits.set(key, { count: 1, reset: now + 60_000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 10;
}

export async function POST(req: Request) {
  let body: { phone?: string; order_no?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "ভুল অনুরোধ" } },
      { status: 400 },
    );
  }

  const phone = formatPhone((body.phone ?? "").trim());
  const orderNo = (body.order_no ?? "").trim().toUpperCase();
  const ip = req.headers.get("x-forwarded-for") ?? "local";

  if (!phone || !orderNo) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "ফোন নম্বর ও অর্ডার নম্বর দুটোই দিন" } },
      { status: 400 },
    );
  }
  if (limited(`${ip}:${phone}`)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "অনেকবার চেষ্টা করা হয়েছে — একটু পরে আবার চেষ্টা করুন" } },
      { status: 429 },
    );
  }

  const rows = await db
    .select({ order: orders, customerPhone: customers.phone, customerName: customers.name })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.orderNo, orderNo), eq(customers.phone, `+88${phone.replace(/^\+88/, "")}`)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "এই ফোন নম্বরে অর্ডার নম্বর মেলেনি" } },
      { status: 404 },
    );
  }

  const o = rows[0].order;
  const meta = statusMeta(o.status);
  const step = publicProgress(o.status);

  return NextResponse.json({
    order_no: o.orderNo,
    status: o.status,
    status_label_bn: o.status === "cancelled" ? "বাতিল" : meta.customerLabel || meta.labelBn,
    progress_step: Math.max(0, step),
    steps: PUBLIC_STEPS,
    delivery_date: o.deliveryDate,
    trial_date: o.trialDate,
    due_amount: Number(o.dueAmount),
    urgent: o.priority === "urgent",
  });
}
