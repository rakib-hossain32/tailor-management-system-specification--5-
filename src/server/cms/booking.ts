import "server-only";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointmentRecords } from "@/db/schema";
import { shopHours } from "@/db/content-schema";
import { ApiError } from "@/lib/api-route";
import { bengaliSlotLabel, dhakaDayRange, isCalendarDate } from "@/lib/appointments";
import type { AppTransaction } from "@/server/audit";

export async function getBookingPolicy(date: string, connection: AppTransaction | typeof db = db) {
  if (!isCalendarDate(date)) throw new ApiError(400, "VALIDATION_ERROR", "সঠিক তারিখ দিন");
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const [policy] = await connection.select().from(shopHours).where(and(eq(shopHours.shopId, 1), eq(shopHours.weekday, weekday))).limit(1);
  if (!policy) throw new ApiError(503, "BOOKING_NOT_CONFIGURED", "দোকানের booking সময়সূচি এখনও সেট করা হয়নি");
  return policy;
}

export async function validateBusinessSlot(date: string, slot: string, now = Date.now(), connection: AppTransaction | typeof db = db) {
  const policy = await getBookingPolicy(date, connection);
  if (policy.closed) throw new ApiError(422, "CLOSED", "এই দিনে দোকান বন্ধ থাকে");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot)) throw new ApiError(400, "VALIDATION_ERROR", "সঠিক সময় দিন");
  const [hour, minute] = slot.split(":").map(Number);
  const startMinute = hour * 60 + minute;
  if (startMinute < policy.opensAtMinute || startMinute + policy.slotMinutes > policy.closesAtMinute ||
      (startMinute - policy.opensAtMinute) % policy.slotMinutes !== 0) {
    throw new ApiError(400, "INVALID_SLOT", "দোকানের সময়সূচি থেকে একটি স্লট বেছে নিন");
  }
  const start = new Date(date + "T" + slot + ":00+06:00");
  const end = new Date(start.getTime() + policy.slotMinutes * 60_000);
  if (start.getTime() <= now) throw new ApiError(422, "PAST_SLOT", "সময়টি পেরিয়ে গেছে — পরের স্লট বেছে নিন");
  return { start, end, label: bengaliSlotLabel(slot) };
}

export async function getBusinessSlots(date: string) {
  const policy = await getBookingPolicy(date);
  if (policy.closed) return { date, slots: [], note: "এই দিনে দোকান বন্ধ থাকে" };
  const range = dhakaDayRange(date);
  const booked = await db.select({ start: appointmentRecords.startsAt, end: appointmentRecords.endsAt }).from(appointmentRecords)
    .where(and(lt(appointmentRecords.startsAt, range.end), gt(appointmentRecords.endsAt, range.start),
      ne(appointmentRecords.status, "cancelled"), ne(appointmentRecords.status, "no_show")));
  const now = Date.now();
  const slots: { start: string; label: string }[] = [];
  for (let minute = policy.opensAtMinute; minute + policy.slotMinutes <= policy.closesAtMinute; minute += policy.slotMinutes) {
    const slot = String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
    const start = new Date(date + "T" + slot + ":00+06:00"), end = new Date(start.getTime() + policy.slotMinutes * 60_000);
    if (start.getTime() > now && !booked.some((booking) => start < booking.end && end > booking.start)) slots.push({ start: slot, label: bengaliSlotLabel(slot) });
  }
  return { date, slots };
}
