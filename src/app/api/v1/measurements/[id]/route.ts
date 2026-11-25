import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { getMeasurement } from "@/server/services/measurements";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export const GET = adminRoute(async (_request, context: Context, actor) => NextResponse.json(await getMeasurement(actor, (await context.params).id)));
