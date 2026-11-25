import { NextResponse } from "next/server";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { apiErrorResponse } from "@/lib/api-route";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ data: await getPublicSiteSnapshot() }); }
  catch (error) { return apiErrorResponse(error); }
}
