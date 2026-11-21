import { ApiError } from "@/lib/api-route";

export const SLOT_MS = 30 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const DHAKA_OFFSET_MS = 6 * 60 * 60_000;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function dhakaDate(now = new Date()): string {
  return new Date(now.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

export function isShopDay(date: string): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() !== 5;
}

export function dhakaDayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00+06:00`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function bengaliSlotLabel(slot: string): string {
  const [hour, minute] = slot.split(":").map(Number);
  const period = hour < 12 ? "সকাল" : hour < 16 ? "দুপুর" : hour < 19 ? "বিকাল" : "রাত";
  return `${period} ${hour % 12 || 12}:${String(minute).padStart(2, "0")}`;
}

export function appointmentSlot(date: unknown, slot: unknown, now = Date.now()): { start: Date; end: Date } {
  if (!isCalendarDate(date) || typeof slot !== "string" || !/^(1\d|20):(00|30)$/.test(slot)) {
    throw new ApiError(400, "VALIDATION_ERROR", "সঠিক তারিখ ও সকাল ১০টা থেকে রাত ৯টার মধ্যে ৩০ মিনিটের স্লট বেছে নিন");
  }
  if (!isShopDay(date)) throw new ApiError(422, "CLOSED", "শুক্রবার ছুটি");
  const start = new Date(`${date}T${slot}:00+06:00`);
  if (start.getTime() < now) throw new ApiError(422, "PAST_SLOT", "এই সময়টি পেরিয়ে গেছে — ভবিষ্যতের স্লট বেছে নিন");
  return { start, end: new Date(start.getTime() + SLOT_MS) };
}
