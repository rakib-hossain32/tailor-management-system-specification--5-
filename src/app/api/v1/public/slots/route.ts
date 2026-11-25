import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api-route";
import { isCalendarDate } from "@/lib/appointments";
import { getBusinessSlots } from "@/server/cms/booking";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (!isCalendarDate(date)) throw new ApiError(400, "VALIDATION_ERROR", "সঠিক তারিখ দিন");
    return NextResponse.json(await getBusinessSlots(date));
  } catch (error) { return apiErrorResponse(error); }
}
