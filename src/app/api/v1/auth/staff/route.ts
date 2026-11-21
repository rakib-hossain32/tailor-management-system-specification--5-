import { NextResponse } from "next/server";
import { createStaffSession, isAdminRole, SESSION_MAX_AGE, STAFF_COOKIE } from "@/lib/auth";
import { authenticateStaff, authErrorResponse } from "@/lib/access";
import { requestClientKey, takeRateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Existing staff accounts only; administrators provision worker accounts. */
export async function POST(req: Request) {
  let body: { identifier?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "ভুল অনুরোধ" } }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "ভুল অনুরোধ" } }, { status: 400 });
  }
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!identifier || identifier.length > 254 || password.length < 4 || password.length > 256) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "সঠিক ইমেইল/মোবাইল নম্বর ও পাসওয়ার্ড দিন" } }, { status: 400 });
  }
  const accountKey = identifier.includes("@") ? identifier.toLowerCase() : normalizePhone(identifier);
  if (!takeRateLimit(`staff:ip:${requestClientKey(req)}`, 50, 15 * 60_000) ||
      !takeRateLimit(`staff:account:${accountKey}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "অনেকবার চেষ্টা হয়েছে — ১৫ মিনিট পরে চেষ্টা করুন" } }, { status: 429 });
  }
  try {
    const user = await authenticateStaff(identifier, password);
    const res = NextResponse.json({ ok: true, role: user.role, redirect: isAdminRole(user.role) ? "/admin" : "/worker", name: user.name });
    res.cookies.set(STAFF_COOKIE, createStaffSession(user.userId, user.role, user.workerId), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("Staff login failed", error);
    return NextResponse.json({ error: { code: "SERVICE_UNAVAILABLE", message: "লগইন সেবা চালু নেই — ডাটাবেস ও সেটআপ যাচাই করুন" } }, { status: 503 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
