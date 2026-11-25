import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { adminRoute } from "@/lib/api-route";
import { saveSiteContent } from "@/server/cms/admin";
type Context = { params: Promise<{ kind: string }> };
export const POST = adminRoute(async (req: Request, context: Context, actor) => {
  const { kind } = await context.params;
  const body: unknown = await req.json();
  const data = await saveSiteContent(kind, body, actor);
  revalidatePath("/", "layout");
  return NextResponse.json({ data }, { status: 201 });
});
