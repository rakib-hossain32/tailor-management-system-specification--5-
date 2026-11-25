import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { getAdminSiteContent } from "@/server/cms/admin";
export const dynamic = "force-dynamic";
export const GET = adminRoute(async (_req, _ctx, actor) => NextResponse.json({ data: await getAdminSiteContent(actor) }));
