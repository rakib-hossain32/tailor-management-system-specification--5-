import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { authErrorResponse, requireAdmin, type StaffSession } from "@/lib/access";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);

export function apiErrorResponse(error: unknown): NextResponse {
  const requestId = randomUUID();
  const denied = authErrorResponse(error);
  if (denied) { denied.headers.set("x-request-id", requestId); return denied; }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "তথ্য সঠিকভাবে দিন",
      fields: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, meta: { requestId } },
      { status: 422, headers: { "x-request-id": requestId } });
  }
  if (error instanceof SyntaxError) return NextResponse.json({ error: { code: "INVALID_JSON", message: "অনুরোধের JSON সঠিক নয়" }, meta: { requestId } }, { status: 400 });
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message }, meta: { requestId } }, { status: error.status, headers: { "x-request-id": requestId } });
  }
  let cause: unknown = error;
  for (let depth = 0; depth < 5 && cause && typeof cause === "object"; depth++) {
    const candidate = cause as { code?: string; cause?: unknown };
    if (candidate.code === "23505") return NextResponse.json({ error: { code: "DUPLICATE_RECORD", message: "এই তথ্য ইতিমধ্যে সংরক্ষিত আছে" }, meta: { requestId } }, { status: 409 });
    if (candidate.code === "23503") return NextResponse.json({ error: { code: "REFERENCE_CONFLICT", message: "এই তথ্য অন্য record-এর সঙ্গে যুক্ত আছে অথবা reference সঠিক নয়" }, meta: { requestId } }, { status: 409 });
    if (candidate.code === "23514") return NextResponse.json({ error: { code: "INVALID_RECORD", message: "তথ্য database-এর নিয়ম মেনে দেওয়া হয়নি" }, meta: { requestId } }, { status: 422 });
    if (candidate.code === "42703" || candidate.code === "42P01") return NextResponse.json({ error: { code: "DATABASE_NOT_UPDATED", message: "ডাটাবেস আপডেট বাকি আছে — npm run db:migrate চালান" }, meta: { requestId } }, { status: 503 });
    cause = candidate.cause;
  }
  console.error("API request failed", { requestId, name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : undefined });
  return NextResponse.json({ error: { code: "SERVER_ERROR", message: "অনুরোধ সম্পন্ন করা যায়নি — আবার চেষ্টা করুন" }, meta: { requestId } }, { status: 500 });
}

/** Authenticate before parsing input or reading any business records. */
export function adminRoute<Context>(
  handler: (request: Request, context: Context, staff: StaffSession) => Promise<Response>,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      const staff = await requireAdmin();
      const response = await handler(request, context, staff);
      response.headers.set("x-request-id", randomUUID());
      response.headers.set("cache-control", "private, no-store");
      return response;
    } catch (error) {
      return apiErrorResponse(error);
    }
  };
}
