import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject, text } from "@/lib/api-input";
import { cancelOrder, getOrder, updateOrder } from "@/server/services/orders";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export const GET = adminRoute(async (_request, context: Context, actor) => NextResponse.json(await getOrder(actor, (await context.params).id)));
export const PATCH = adminRoute(async (request, context: Context, actor) => NextResponse.json(await updateOrder(actor, (await context.params).id, await jsonObject(request))));
export const DELETE = adminRoute(async (request, context: Context, actor) => {
  const body = request.body ? await jsonObject(request) : {};
  return NextResponse.json(await cancelOrder(actor, (await context.params).id, text(body.reason, "বাতিলের কারণ", 1000)));
});
