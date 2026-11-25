import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { opsResource } from "@/server/services/ops-registry";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export const GET = adminRoute(async (request, context: Context, actor) => {
  const { resource } = await context.params;
  const query = new URL(request.url).searchParams;
  const result = await opsResource(resource).list(actor, { q: query.get("q") ?? undefined, page: query.has("page") ? Number(query.get("page")) : undefined, limit: query.has("limit") ? Number(query.get("limit")) : undefined });
  return NextResponse.json({ data: result.rows, meta: { total: result.total, page: result.page, limit: result.limit } });
});
export const POST = adminRoute(async (request, context: Context, actor) => {
  const { resource } = await context.params;
  const data = await opsResource(resource).create(actor, await jsonObject(request));
  revalidatePath("/admin", "layout");
  if (resource === "garments") { revalidatePath("/"); revalidatePath("/services"); }
  return NextResponse.json({ data }, { status: 201 });
});
