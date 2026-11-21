import { NextResponse } from "next/server";
import { and, gt, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { ApiError, apiErrorResponse } from "@/lib/api-route";
import { appointmentSlot, bengaliSlotLabel, dhakaDate, dhakaDayRange, isCalendarDate, isShopDay } from "@/lib/appointments";

export const dynamic = "force-dynamic";

/** Available 30-minute slots in Asia/Dhaka, independent of the host clock zone. */
export async function GET(req: Request) {
  try {
    const date = new URL(req.url).searchParams.get("date");
    if (!isCalendarDate(date)) throw new ApiError(400, "VALIDATION_ERROR", "সঠিক তারিখ দিন");
    if (!isShopDay(date)) return NextResponse.json({ slots: [], date, note: "শুক্রবার ছুটি" });
    const now = Date.now();
    if (date < dhakaDate(new Date(now))) return NextResponse.json({ slots: [], date });
    const range = dhakaDayRange(date);
    const rows = await db.select({ start: appointments.startsAt, end: appointments.endsAt }).from(appointments)
      .where(and(lt(appointments.startsAt, range.end), gt(appointments.endsAt, range.start), ne(appointments.status, "cancelled"), ne(appointments.status, "no_show")));
    const slots: { start: string; label: string }[] = [];
    for (let hour = 10; hour < 21; hour++) {
      for (const minute of [0, 30]) {
        const slot = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const { start, end } = appointmentSlot(date, slot, 0);
        if (start.getTime() < now || rows.some((row) => start < row.end && end > row.start)) continue;
        slots.push({ start: slot, label: bengaliSlotLabel(slot) });
      }
    }
    return NextResponse.json({ slots, date });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
