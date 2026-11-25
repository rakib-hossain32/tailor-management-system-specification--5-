import "server-only";
import type { StaffSession } from "@/lib/access";
import { AuthError } from "@/lib/access";
import { isAdminRole } from "@/lib/auth";
import { ApiError, isUuid } from "@/lib/api-route";
import { text, numberValue, money } from "@/lib/api-input";
import { normalizeDigits } from "@/lib/units";

export type Actor = StaffSession;
export type Input = Record<string, unknown>;
export type ListOptions = { q?: string; page?: number; limit?: number };
export const STAGES = ["cutting", "stitching", "finishing"] as const;

export function authorize(actor: Actor, scope: "owner" | "management" | "admin" | "staff" = "admin") {
  if (!actor?.userId) throw new AuthError(401, "লগইন করুন");
  if (actor.role === "worker" && !actor.workerId) throw new AuthError(403, "সক্রিয় কারিগর প্রোফাইল প্রয়োজন");
  const allowed = scope === "owner" ? actor.role === "owner" : scope === "management" ? ["owner", "manager"].includes(actor.role) : scope === "admin" ? isAdminRole(actor.role) : isAdminRole(actor.role) || actor.role === "worker";
  if (!allowed) throw new AuthError(403, "এই কাজের অনুমতি নেই");
}
export function uuid(value: unknown, label = "পরিচয়"): string {
  if (!isUuid(value)) throw new ApiError(422, "VALIDATION_ERROR", label + " সঠিক নয়");
  return value;
}
export function required(value: unknown, label: string, max = 150) {
  const result = text(value, label, max) ?? "";
  if (!result) throw new ApiError(422, "VALIDATION_ERROR", label + " দিন");
  return result;
}
export function choice(value: unknown, options: readonly string[], label: string, fallback?: string) {
  const result = value === undefined ? fallback : value;
  if (typeof result !== "string" || !options.includes(result)) throw new ApiError(422, "VALIDATION_ERROR", label + " সঠিক নয়");
  return result;
}
export function bool(value: unknown, fallback = true) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new ApiError(422, "VALIDATION_ERROR", "সক্রিয় অবস্থা সঠিক নয়");
  return value;
}
export function strings(value: unknown, label: string, max = 30) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== "string" || item.trim().length > 150)) throw new ApiError(422, "VALIDATION_ERROR", label + " সঠিক নয়");
  return [...new Set(value.map((item: string) => item.trim()).filter(Boolean))];
}
export function date(value: unknown, label: string, nullable = false): string | null {
  if (nullable && (value === undefined || value === null || value === "")) return null;
  const result = required(value, label, 10);
  const parsed = new Date(result + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) throw new ApiError(422, "VALIDATION_ERROR", label + " সঠিক নয়");
  return result;
}
export function amount(value: unknown, label: string, fallback = 0) {
  return (money(value, label, fallback) / 100).toFixed(2);
}
export function quantity(value: unknown, label: string, allowNegative = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 9_999_999_999 || (!allowNegative && value < 0) || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new ApiError(422, "VALIDATION_ERROR", label + " সঠিক নয়");
  return Math.round(value * 100) / 100;
}
export function page(options: ListOptions = {}) {
  const limit = numberValue(options.limit, "পৃষ্ঠা আকার", 50, 100, true);
  const current = numberValue(options.page, "পৃষ্ঠা", 1, 100000, true);
  if (limit < 1 || current < 1) throw new ApiError(422, "VALIDATION_ERROR", "পৃষ্ঠা সঠিক নয়");
  return { q: text(options.q, "অনুসন্ধান", 100) ?? "", limit, page: current, offset: (current - 1) * limit };
}
/**
 * Search terms for a free-text query: the raw text (for name matching)
 * plus a digit-normalized copy. Staff type phone numbers and codes
 * with BENGALI digits (০১৭…), but phones/codes are stored with Latin
 * digits — and JS digit classes ignore Bengali digits entirely, so a
 * raw query never matches them. Match phone/code columns against
 * `normalized` (or the digit-only `digits`).
 */
export function searchTerms(q: string) {
  const normalized = normalizeDigits(q);
  return { raw: q, normalized, digits: normalized.replace(/\D/g, "") };
}

export function changedFields(input: Input) {
  return Object.keys(input).filter((key) => !/password|secret|token/i.test(key));
}
export function personFields(input: Input) {
  return Object.fromEntries(["name", "phone", "altPhone", "email", "address", "birthDate", "gender", "bodyNotes"].filter((key) => key in input).map((key) => [key, input[key]]));
}
export function present<T>(value: T | undefined, label: string): T {
  if (!value) throw new ApiError(404, "NOT_FOUND", label + " পাওয়া যায়নি");
  return value;
}
