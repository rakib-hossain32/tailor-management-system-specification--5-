import { NextResponse } from "next/server";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, measurementProfiles } from "@/db/schema";
import { adminRoute, ApiError } from "@/lib/api-route";
import { jsonObject, text } from "@/lib/api-input";
import { formatPhone, normalizePhone, isValidBdPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

const customerFields = {
  c: customers,
  openDue: sql<string>`coalesce((select sum(orders.due_amount) from orders where orders.customer_id = ${customers.id} and orders.status not in ('delivered','cancelled')),0)`,
  orderCount: sql<number>`(select count(*)::int from orders where orders.customer_id = ${customers.id})`,
};

function customerResponse(row: typeof customers.$inferSelect, openDue = 0, orderCount = 0) {
  return { id: row.id, name: row.name, phone: formatPhone(row.phone), address: row.address, tags: row.tags, open_due: openDue, order_count: orderCount };
}

/** Quick search for the authenticated order wizard. */
export const GET = adminRoute(async (req) => {
  const q = text(new URL(req.url).searchParams.get("q"), "অনুসন্ধান", 100) ?? "";
  const digits = q.replace(/\D/g, "");
  const rows = await db.select(customerFields).from(customers)
    .where(q ? or(ilike(customers.name, `%${q}%`), ilike(customers.phone, `%${q}%`), digits ? ilike(customers.phone, `%${digits}%`) : undefined) : undefined)
    .limit(12);
  return NextResponse.json({ customers: rows.map((row) => customerResponse(row.c, Number(row.openDue), row.orderCount)) });
});

/** Create the customer and required default measurement profile together. */
export const POST = adminRoute(async (req) => {
  const body = await jsonObject(req);
  const name = text(body.name, "কাস্টমারের নাম", 150) ?? "";
  const phone = normalizePhone(text(body.phone, "ফোন নম্বর", 40) ?? "");
  const address = text(body.address, "ঠিকানা", 500) || null;
  if (name.length < 2) throw new ApiError(400, "VALIDATION_ERROR", "কাস্টমারের নাম লিখুন");
  if (!isValidBdPhone(phone)) throw new ApiError(400, "VALIDATION_ERROR", "সঠিক ফোন নম্বর দিন (01XXXXXXXXX)");
  if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.length > 20 || body.tags.some((tag) => typeof tag !== "string" || tag.length > 100))) {
    throw new ApiError(400, "VALIDATION_ERROR", "ট্যাগ সঠিকভাবে দিন");
  }
  const tags = (body.tags ?? []) as string[];
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'customer:' + phone}))`);
    const [duplicate] = await tx.select(customerFields).from(customers).where(eq(customers.phone, phone)).limit(1);
    if (duplicate) return { row: duplicate.c, created: false, openDue: Number(duplicate.openDue), orderCount: duplicate.orderCount };
    const [row] = await tx.insert(customers).values({ name, phone, address, tags }).returning();
    await tx.insert(measurementProfiles).values({ customerId: row.id, displayName: "নিজে", relation: "self", gender: row.gender, isDefault: true });
    return { row, created: true, openDue: 0, orderCount: 0 };
  });
  const customer = customerResponse(result.row, result.openDue, result.orderCount);
  if (!result.created) {
    return NextResponse.json({ error: { code: "DUPLICATE", message: "এই ফোন নম্বরে কাস্টমার আছেন", customer_id: result.row.id }, customer }, { status: 409 });
  }
  return NextResponse.json(customer, { status: 201 });
});
