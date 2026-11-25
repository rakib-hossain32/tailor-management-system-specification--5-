import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { changeOrderStatus } from "@/server/services/orders";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export const POST = adminRoute(async (request, context: Context, actor) => NextResponse.json(await changeOrderStatus(actor, (await context.params).id, await jsonObject(request))));
