import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { createProfile, listProfiles } from "@/server/services/profiles";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export const GET = adminRoute(async (_request, context: Context, actor) => NextResponse.json({ profiles: await listProfiles(actor, (await context.params).id) }));
export const POST = adminRoute(async (request, context: Context, actor) => {
  const id = (await context.params).id;
  return NextResponse.json(await createProfile(actor, { ...await jsonObject(request), customerId: id, customer_id: id }), { status: 201 });
});
