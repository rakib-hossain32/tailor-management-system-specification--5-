import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { createOrder, listOrders } from "@/server/services/orders";

export const dynamic = "force-dynamic";
export const GET = adminRoute(async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const result = await listOrders(actor, { customerId: q.get("customer_id") ?? undefined, status: q.get("status") ?? undefined, q: q.get("q") ?? undefined, page: q.has("page") ? Number(q.get("page")) : undefined, limit: q.has("limit") ? Number(q.get("limit")) : undefined });
  return NextResponse.json({ orders: result.rows, total: result.total, page: result.page, limit: result.limit });
});
export const POST = adminRoute(async (request, _context, actor) => NextResponse.json(await createOrder(actor, await jsonObject(request)), { status: 201 }));
