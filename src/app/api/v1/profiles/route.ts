import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { createProfile, listProfiles } from "@/server/services/profiles";

export const dynamic = "force-dynamic";
export const GET = adminRoute(async (request, _context, actor) => NextResponse.json({ profiles: await listProfiles(actor, new URL(request.url).searchParams.get("customer_id") ?? undefined) }));
export const POST = adminRoute(async (request, _context, actor) => NextResponse.json(await createProfile(actor, await jsonObject(request)), { status: 201 }));
