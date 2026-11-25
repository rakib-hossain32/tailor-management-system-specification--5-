import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { deleteDraft, getDraft, saveDraft } from "@/server/services/drafts";

export const dynamic = "force-dynamic";
export const GET = adminRoute(async (_request, _context, actor) => NextResponse.json(await getDraft(actor)));
export const PUT = adminRoute(async (request, _context, actor) => NextResponse.json(await saveDraft(actor, (await jsonObject(request)).draft)));
export const DELETE = adminRoute(async (_request, _context, actor) => NextResponse.json(await deleteDraft(actor)));
