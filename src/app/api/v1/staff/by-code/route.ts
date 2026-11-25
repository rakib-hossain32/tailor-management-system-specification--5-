import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, customers } from "@/db/schema";
import { getStaffSession } from "@/lib/access";
import { isAdminRole } from "@/lib/auth";
import { recordCode, digitsOnly } from "@/lib/barcode";
import { takeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resolve a printed card's 12-digit barcode number to its record.
 *
 * Staff session required — the number on paper is not a credential,
 * it is just a lookup key, and this endpoint is the only thing that
 * turns it into a record id. Appointments resolve for admins AND
 * workers (the scan page then applies its role-based view); customer
 * codes (measurement cards) resolve for admins only, matching the
 * worker privacy rule. Rate-limited per staffer against enumeration.
 */
export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "স্টাফ লগইন প্রয়োজন" } },
      { status: 401 },
    );
  }
  if (!takeRateLimit(`by-code:${session.userId}`, 60, 10 * 60_000)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "অনেকবার চেষ্টা হয়েছে — কিছুক্ষণ পরে আবার চেষ্টা করুন" } },
      { status: 429 },
    );
  }
  const code = digitsOnly(new URL(request.url).searchParams.get("code") ?? "");
  if (code.length !== 12) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "বারকোডের ১২ ডিজিটের নম্বর দিন" } },
      { status: 422 },
    );
  }

  const apptRows = await db.select({ id: appointments.id }).from(appointments);
  const appt = apptRows.find((r) => recordCode(r.id) === code);
  if (appt) {
    return NextResponse.json({ data: { type: "appointment", id: appt.id } });
  }

  if (isAdminRole(session.role)) {
    const custRows = await db.select({ id: customers.id }).from(customers);
    const cust = custRows.find((r) => recordCode(r.id) === code);
    if (cust) {
      return NextResponse.json({ data: { type: "customer", id: cust.id } });
    }
  }

  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: "এই নম্বরে কোনো রেকর্ড পাওয়া যায়নি" } },
    { status: 404 },
  );
}
