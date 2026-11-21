import { NextResponse } from "next/server";
import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, customers } from "@/db/schema";
import { ApiError, apiErrorResponse } from "@/lib/api-route";
import { jsonObject, text } from "@/lib/api-input";
import { appointmentSlot, bengaliSlotLabel } from "@/lib/appointments";
import { isValidBdPhone, normalizePhone } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Public booking with one atomic capacity check in the shop's time zone. */
export async function POST(req: Request) {
  try {
    const body = await jsonObject(req);
    const name = text(body.name, "নাম", 150) ?? "";
    const phone = normalizePhone(text(body.phone, "ফোন নম্বর", 40) ?? "");
    const date = text(body.date, "তারিখ", 10) ?? "";
    const slot = text(body.slot, "সময়", 5) ?? "";
    const purpose = text(body.purpose, "উদ্দেশ্য", 60) || "নতুন মাপ";
    const locationType = text(body.location_type, "অ্যাপয়েন্টমেন্টের স্থান", 10) ?? "shop";
    const address = text(body.address, "ঠিকানা", 500) || null;
    const notes = text(body.notes, "নোট") || null;
    if (name.length < 2) throw new ApiError(400, "VALIDATION_ERROR", "নাম লিখুন");
    if (!isValidBdPhone(phone)) throw new ApiError(400, "VALIDATION_ERROR", "সঠিক ফোন নম্বর দিন (01XXXXXXXXX)");
    if (!["shop", "home"].includes(locationType) || (locationType === "home" && (!address || address.length < 5))) throw new ApiError(400, "VALIDATION_ERROR", "অ্যাপয়েন্টমেন্টের স্থান ও হোম ভিজিটের ঠিকানা সঠিকভাবে দিন");
    const { start, end } = appointmentSlot(date, slot);
    const row = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'appointment-slot:' + start.toISOString()}))`);
      // Recheck time after waiting for the lock, then check every overlap.
      appointmentSlot(date, slot);
      const [clash] = await tx.select({ id: appointments.id }).from(appointments)
        .where(and(lt(appointments.startsAt, end), gt(appointments.endsAt, start), ne(appointments.status, "cancelled"), ne(appointments.status, "no_show"))).limit(1);
      if (clash) throw new ApiError(409, "SLOT_TAKEN", "এই সময়টি এখনই বুক হয়ে গেছে — অন্য স্লট বেছে নিন");
      const [existing] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.phone, phone)).limit(1);
      const [created] = await tx.insert(appointments).values({ customerId: existing?.id ?? null, name, phone, purpose, startsAt: start, endsAt: end, status: "booked", locationType, address, notes }).returning({ id: appointments.id });
      return created;
    });
    return NextResponse.json({ id: row.id, date, slot_label: bengaliSlotLabel(slot) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
