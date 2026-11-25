import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { archiveCustomer, getCustomer, updateCustomer } from "@/server/services/customers";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export const GET = adminRoute(async (_request, context: Context, actor) => NextResponse.json(await getCustomer(actor, (await context.params).id)));
export const PATCH = adminRoute(async (request, context: Context, actor) => NextResponse.json(await updateCustomer(actor, (await context.params).id, await jsonObject(request))));
export const DELETE = adminRoute(async (_request, context: Context, actor) => NextResponse.json({ ok: true, customer: await archiveCustomer(actor, (await context.params).id) }));
