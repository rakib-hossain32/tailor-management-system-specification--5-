import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { listPayments, recordPayment } from "@/server/services/payments";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export const GET = adminRoute(async (request, context: Context, actor) => NextResponse.json({ payments: await listPayments(actor, (await context.params).id, new URL(request.url).searchParams.get("customer_id") ?? undefined) }));
export const POST = adminRoute(async (request, context: Context, actor) => NextResponse.json(await recordPayment(actor, (await context.params).id, await jsonObject(request))));
