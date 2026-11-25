import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { adminRoute } from "@/lib/api-route";
import { deleteSiteContent, saveSiteContent } from "@/server/cms/admin";
type Context = { params: Promise<{ kind: string; id: string }> };
export const PATCH = adminRoute(async (req: Request, context: Context, actor) => {
  const { kind, id } = await context.params;
  const data = await saveSiteContent(kind, await req.json(), actor, id);
  revalidatePath("/", "layout");
  return NextResponse.json({ data });
});
export const DELETE = adminRoute(async (_req: Request, context: Context, actor) => {
  const { kind, id } = await context.params;
  const data = await deleteSiteContent(kind, id, actor);
  revalidatePath("/", "layout");
  return NextResponse.json({ data });
});
