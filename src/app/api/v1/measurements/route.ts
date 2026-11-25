import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { createMeasurement, listMeasurements } from "@/server/services/measurements";

export const dynamic = "force-dynamic";
export const GET = adminRoute(async (request, _context, actor) => {
  const q = new URL(request.url).searchParams;
  const result = await listMeasurements(actor, { profileId: q.get("profile_id") ?? undefined, garmentTypeId: q.get("garment_type_id") ?? undefined, currentOnly: q.get("current") === "true", page: q.has("page") ? Number(q.get("page")) : undefined, limit: q.has("limit") ? Number(q.get("limit")) : undefined });
  return NextResponse.json({ measurements: result.rows, total: result.total, page: result.page, limit: result.limit });
});
export const POST = adminRoute(async (request, _context, actor) => NextResponse.json(await createMeasurement(actor, await jsonObject(request)), { status: 201 }));
