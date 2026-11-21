import { ApiError } from "@/lib/api-route";

export const MAX_MONEY = 9_999_999_999.99;

export async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "ভুল অনুরোধ");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "ভুল অনুরোধ");
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown, label: string, max = 2_000): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} সঠিকভাবে দিন`);
  }
  return value.trim();
}

export function numberValue(value: unknown, label: string, fallback = 0, max = MAX_MONEY, integer = false): number {
  const parsed = value === undefined ? fallback : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0 || parsed > max || (integer && !Number.isSafeInteger(parsed))) {
    throw new ApiError(422, "VALIDATION_ERROR", `${label} সঠিকভাবে দিন`);
  }
  return parsed;
}

export function money(value: unknown, label: string, fallback = 0): number {
  const parsed = numberValue(value, label, fallback);
  if (Math.abs(parsed * 100 - Math.round(parsed * 100)) > 0.000_01) {
    throw new ApiError(422, "VALIDATION_ERROR", `${label} সর্বোচ্চ দুই দশমিক পর্যন্ত দিন`);
  }
  return Math.round(parsed * 100);
}

export function stringRecord(value: unknown, label: string): Record<string, string> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} সঠিকভাবে দিন`);
  }
  const entries = Object.entries(value);
  if (entries.length > 100 || entries.some(([key, entry]) => key.length > 100 || typeof entry !== "string" || entry.length > 500)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} সঠিকভাবে দিন`);
  }
  return Object.fromEntries(entries) as Record<string, string>;
}
