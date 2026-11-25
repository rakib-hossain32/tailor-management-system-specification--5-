import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { archiveProfile, getProfile, updateProfile } from "@/server/services/profiles";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export const GET = adminRoute(async (_request, context: Context, actor) => NextResponse.json(await getProfile(actor, (await context.params).id)));
export const PATCH = adminRoute(async (request, context: Context, actor) => NextResponse.json(await updateProfile(actor, (await context.params).id, await jsonObject(request))));
export const DELETE = adminRoute(async (_request, context: Context, actor) => NextResponse.json({ ok: true, profile: await archiveProfile(actor, (await context.params).id) }));
