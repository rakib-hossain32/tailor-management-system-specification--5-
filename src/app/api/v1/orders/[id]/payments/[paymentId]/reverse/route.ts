import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { reversePayment } from "@/server/services/payments";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; paymentId: string }> };
export const POST = adminRoute(async (request, context: Context, actor) => {
  const { id, paymentId } = await context.params;
  return NextResponse.json(await reversePayment(actor, id, paymentId, await jsonObject(request)));
});
