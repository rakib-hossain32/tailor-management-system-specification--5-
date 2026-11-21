import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { isValidBdPhone, normalizePhone } from "@/lib/format";
import { authSecret, SESSION_MAX_AGE } from "@/lib/auth";
import { sign, SESSION_COOKIE } from "@/lib/session";
import { requestClientKey, takeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const TTL_MS = 5 * 60_000;
type Pending = { digest: string; exp: number; attempts: number };
const state = globalThis as typeof globalThis & { __tailorOtpStore?: Map<string, Pending> };
const store = state.__tailorOtpStore ??= new Map<string, Pending>();
const digest = (phone: string, code: string) => createHmac("sha256", authSecret()).update(`${phone}:${code}`).digest("hex");

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  let body: { action?: unknown; phone?: unknown; code?: unknown };
  try { body = await req.json(); } catch { return fail("VALIDATION_ERROR", "ভুল অনুরোধ", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("VALIDATION_ERROR", "ভুল অনুরোধ", 400);
  if (typeof body.phone !== "string" || body.phone.length > 40) return fail("VALIDATION_ERROR", "ফোন নম্বর দিন", 400);
  const phone = normalizePhone(body.phone);
  if (!isValidBdPhone(phone)) return fail("VALIDATION_ERROR", "সঠিক ফোন নম্বর দিন (01XXXXXXXXX)", 400);
  if (body.action !== "request" && body.action !== "verify") return fail("VALIDATION_ERROR", "সঠিক action দিন", 400);
  const demoMode = process.env.LOCAL_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
  if (body.action === "request" && !demoMode && (!process.env.SMS_WEBHOOK_URL || !process.env.SMS_WEBHOOK_TOKEN)) {
    return fail("SMS_NOT_CONFIGURED", "SMS সেবা চালু নেই — দোকানের সঙ্গে যোগাযোগ করুন", 503);
  }
  const windowMs = 10 * 60_000;
  if (!takeRateLimit(`otp:ip:${requestClientKey(req)}`, 50, windowMs) ||
      !takeRateLimit(`otp:${body.action}:${phone}`, body.action === "request" ? 5 : 10, windowMs)) {
    return fail("RATE_LIMITED", "অনেকবার চেষ্টা হয়েছে — ১০ মিনিট পরে চেষ্টা করুন", 429);
  }
  try {
    const [customer] = await db.select({ id: customers.id, name: customers.name, enabled: customers.portalEnabled }).from(customers).where(eq(customers.phone, phone)).limit(1);
    if (!customer || !customer.enabled) {
      store.delete(phone);
      return fail("PORTAL_UNAVAILABLE", "এই নম্বরে পোর্টাল চালু নেই — দোকানের সঙ্গে যোগাযোগ করুন", 403);
    }
    const now = Date.now();
    for (const [key, pending] of store) if (pending.exp <= now) store.delete(key);
    if (body.action === "request") {
      const code = String(randomInt(100000, 1000000));
      if (!demoMode) {
        const url = new URL(process.env.SMS_WEBHOOK_URL!);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid SMS webhook URL");
        const sent = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` },
          body: JSON.stringify({ to: phone, message: `আপনার রহমান টেইলার্স লগইন কোড: ${code}। মেয়াদ ৫ মিনিট।`, code, expires_in_seconds: 300 }),
          signal: AbortSignal.timeout(10000),
        });
        if (!sent.ok) return fail("SMS_FAILED", "কোড পাঠানো যায়নি — কিছুক্ষণ পরে চেষ্টা করুন", 503);
      }
      if (store.size >= 10000 && !store.has(phone)) return fail("SERVICE_BUSY", "কিছুক্ষণ পরে চেষ্টা করুন", 503);
      store.set(phone, { digest: digest(phone, code), exp: now + TTL_MS, attempts: 0 });
      return NextResponse.json({ ok: true, sent: !demoMode, demo: demoMode, minutes: 5, ...(demoMode ? { dev_code: code } : {}) });
    }
    const pending = store.get(phone);
    if (!pending || pending.exp <= now) return fail("EXPIRED", "কোডের মেয়াদ শেষ — নতুন কোড চান", 410);
    pending.attempts += 1;
    const code = typeof body.code === "string" ? body.code : "";
    const valid = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(digest(phone, code), "hex"), Buffer.from(pending.digest, "hex"));
    if (!valid) {
      if (pending.attempts >= 5) store.delete(phone);
      return fail("INVALID_CODE", pending.attempts >= 5 ? "অনেকবার ভুল কোড — নতুন কোড চান" : "কোড সঠিক নয়", 401);
    }
    store.delete(phone);
    const res = NextResponse.json({ ok: true, name: customer.name, customer_id: customer.id });
    res.cookies.set(SESSION_COOKIE, sign(customer.id), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (error) {
    console.error("OTP service failed", error);
    return fail("SERVICE_UNAVAILABLE", "লগইন সেবা চালু নেই — কিছুক্ষণ পরে চেষ্টা করুন", 503);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
