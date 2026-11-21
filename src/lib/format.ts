/** Bengali-first formatting helpers (dates, money, phones). */

export function taka(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const rounded = Math.round(safe * 100) / 100;
  const [whole, frac] = rounded.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracPart = frac === "00" ? "" : `.${frac}`;
  return `৳ ${grouped}${fracPart}`;
}

const MONTHS_BN = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** DD/MM/YYYY — the format Bangladeshi shops actually print. */
export function dateShort(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function dateBn(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${d.getDate()} ${MONTHS_BN[d.getMonth()]} ${d.getFullYear()}`;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whole days between today and the date (negative = past). */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const d = toDate(value);
  if (!d) return null;
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday().getTime()) / 86_400_000);
}

export function relativeDay(value: string | Date | null | undefined): string {
  const n = daysUntil(value);
  if (n === null) return "—";
  if (n === 0) return "আজ";
  if (n === 1) return "কাল";
  if (n === -1) return "গতকাল";
  if (n < 0) return `${Math.abs(n)} দিন আগে`;
  return `${n} দিন পরে`;
}

/** 01XXXXXXXXX → 01XXXXXXXXX (kept as-is), masked for workers: 017*****42 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone ?? "";
  return `${phone.slice(0, 4)}${"*".repeat(Math.max(0, phone.length - 7))}${phone.slice(-3)}`;
}

/** Accept 01XXXXXXXXX or +8801XXXXXXXXX, store normalized +8801XXXXXXXXX. */
export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("8801")) return `+${digits}`;
  if (digits.startsWith("01")) return `+88${digits}`;
  if (digits.startsWith("1") && digits.length === 10) return `+880${digits}`;
  return digits ? `+${digits}` : "";
}

export function isValidBdPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return /^\+8801[3-9]\d{8}$/.test(n);
}

export function formatPhone(raw: string): string {
  const n = normalizePhone(raw);
  const m = n.match(/^\+88(01[3-9]\d{8})$/);
  return m ? m[1] : raw;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
