import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { opsResource } from "@/server/services/ops-registry";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string; id: string }> };
export const GET = adminRoute(async (_request, context: Context, actor) => {
  const { resource, id } = await context.params;
  return NextResponse.json({ data: await opsResource(resource).get(actor, id) });
});
export const PATCH = adminRoute(async (request, context: Context, actor) => {
  const { resource, id } = await context.params;
  const data = await opsResource(resource).update(actor, id, await jsonObject(request));
  revalidatePath("/admin", "layout");
  if (resource === "garments") { revalidatePath("/"); revalidatePath("/services"); }
  return NextResponse.json({ data });
});
export const PUT = PATCH;
export const DELETE = adminRoute(async (_request, context: Context, actor) => {
  const { resource, id } = await context.params;
  const data = await opsResource(resource).archive(actor, id);
  revalidatePath("/admin", "layout");
  if (resource === "garments") { revalidatePath("/"); revalidatePath("/services"); }
  return NextResponse.json({ data });
});
