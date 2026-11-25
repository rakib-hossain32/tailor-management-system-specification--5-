import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { formatPhone } from "@/lib/format";
import { createCustomer, listCustomers } from "@/server/services/customers";

export const dynamic = "force-dynamic";
export const GET = adminRoute(async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const result = await listCustomers(actor, { q: q.get("q") ?? undefined, page: q.has("page") ? Number(q.get("page")) : undefined, limit: q.has("limit") ? Number(q.get("limit")) : 12, includeArchived: q.get("include_archived") === "true" });
  return NextResponse.json({ customers: result.rows, total: result.total, page: result.page, limit: result.limit });
});
export const POST = adminRoute(async (request, _context, actor) => {
  const result = await createCustomer(actor, await jsonObject(request));
  const customer = { ...result.customer, phone: formatPhone(result.customer.phone) };
  if (!result.created) return NextResponse.json({ error: { code: "DUPLICATE", message: "এই ফোন নম্বরে কাস্টমার আছেন", customer_id: result.id }, customer }, { status: 409 });
  return NextResponse.json(customer, { status: 201 });
});
