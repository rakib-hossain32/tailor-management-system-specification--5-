import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-route";
import { jsonObject } from "@/lib/api-input";
import { bengaliSlotLabel } from "@/lib/appointments";
import { createAppointment } from "@/server/services/appointments";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const result = await createAppointment(null, await jsonObject(request));
    return NextResponse.json({ id: result.id, date: result.date, slot_label: bengaliSlotLabel(result.slot) }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
