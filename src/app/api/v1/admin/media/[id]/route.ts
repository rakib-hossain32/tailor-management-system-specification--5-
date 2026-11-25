import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { requireOwnerOrManager } from "@/lib/access";
import { deleteMedia, updateMedia } from "@/server/media/service";
type Context = { params: Promise<{ id: string }> };
export const PATCH = adminRoute(async (req: Request, ctx: Context, actor) => {
  await requireOwnerOrManager();
  return NextResponse.json({ data: await updateMedia((await ctx.params).id, await req.json(), actor) });
});
export const DELETE = adminRoute(async (_req: Request, ctx: Context, actor) => {
  await requireOwnerOrManager();
  return NextResponse.json({ data: await deleteMedia((await ctx.params).id, actor) });
});
