import { NextResponse } from "next/server";
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
  const denied = authErrorResponse(error);
  if (denied) return denied;
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error("API request failed", error);
  return NextResponse.json({ error: { code: "SERVER_ERROR", message: "অনুরোধ সম্পন্ন করা যায়নি — আবার চেষ্টা করুন" } }, { status: 500 });
}

/** Authenticate before parsing input or reading any business records. */
export function adminRoute<Context>(
  handler: (request: Request, context: Context, staff: StaffSession) => Promise<Response>,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      const staff = await requireAdmin();
      return await handler(request, context, staff);
    } catch (error) {
      return apiErrorResponse(error);
    }
  };
}
