"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateStaff, AuthError } from "@/lib/access";
import { createStaffSession, isAdminRole, SESSION_MAX_AGE, STAFF_COOKIE } from "@/lib/auth";
import { takeRateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/format";

export async function loginStaff(formData: FormData): Promise<void> {
  const identifier = String(formData.get("identifier") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim();
  const accountKey = identifier.includes("@") ? identifier.toLowerCase() : normalizePhone(identifier);
  if (!takeRateLimit(`staff:account:${accountKey}`, 10, 15 * 60_000)) redirect("/staff-login?error=" + encodeURIComponent("অনেকবার চেষ্টা হয়েছে — ১৫ মিনিট পরে চেষ্টা করুন"));
  let user;
  try {
    user = await authenticateStaff(identifier, password);
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "লগইন সেবা চালু নেই";
    redirect("/staff-login?error=" + encodeURIComponent(message));
  }
  (await cookies()).set(STAFF_COOKIE, createStaffSession(user.userId, user.role, user.workerId), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE,
  });
  const target = isAdminRole(user.role) && (next === "/admin" || next.startsWith("/admin/")) ? next : isAdminRole(user.role) ? "/admin" : "/worker";
  redirect(target);
}

export async function logoutStaff(): Promise<void> {
  (await cookies()).set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  redirect("/staff-login");
}
