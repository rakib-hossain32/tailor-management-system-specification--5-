import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, users, userAccounts, workers } from "@/db/schema";
import { isAdminRole, readStaffSession, STAFF_COOKIE, verifyPassword } from "@/lib/auth";
import { isValidBdPhone, normalizePhone } from "@/lib/format";
import { SESSION_COOKIE, unsign } from "@/lib/session";

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string, public code = status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN") {
    super(message);
    this.name = "AuthError";
  }
}

export type StaffSession = { id: string; userId: string; name: string; role: string; workerId: string | null; expiresAt: number };

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function authenticateStaff(identifier: string, password: string): Promise<Omit<StaffSession, "expiresAt">> {
  const raw = identifier.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
  const phone = isEmail ? "" : normalizePhone(raw);
  if ((!isEmail && !isValidBdPhone(phone)) || raw.length > 254 || password.length < 4 || password.length > 256) {
    throw new AuthError(401, "ইমেইল/মোবাইল নম্বর বা পাসওয়ার্ড সঠিক নয়", "INVALID_CREDENTIALS");
  }
  const [user] = await db.select().from(users).where(isEmail ? sql`lower(${users.email}) = ${raw.toLowerCase()}` : eq(users.phone, phone)).limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) throw new AuthError(401, "ইমেইল/মোবাইল নম্বর বা পাসওয়ার্ড সঠিক নয়", "INVALID_CREDENTIALS");
  if (!user.isActive || (!isAdminRole(user.role) && user.role !== "worker")) throw new AuthError(403, "এই অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে", "DISABLED");
  let workerId: string | null = null;
  if (user.role === "worker") {
    const [worker] = await db.select({ id: workers.id }).from(workers).where(and(eq(workers.userId, user.id), eq(workers.isActive, true))).limit(1);
    if (!worker) throw new AuthError(403, "এই অ্যাকাউন্টে সক্রিয় কারিগর প্রোফাইল যুক্ত নেই", "WORKER_NOT_LINKED");
    workerId = worker.id;
  }
  await db.update(userAccounts).set({ lastLoginAt: new Date() }).where(eq(userAccounts.id, user.id));
  return { id: user.id, userId: user.id, name: user.name, role: user.role, workerId };
}

/** Re-read the active account and worker link; cookie claims are not authorization. */
export async function getStaffSession(): Promise<StaffSession | null> {
  const token = readStaffSession((await cookies()).get(STAFF_COOKIE)?.value);
  if (!token || !UUID.test(token.userId)) return null;
  const [user] = await db.select().from(users).where(and(eq(users.id, token.userId), eq(users.isActive, true))).limit(1);
  if (!user || user.role !== token.role || (!isAdminRole(user.role) && user.role !== "worker")) return null;
  let workerId: string | null = null;
  if (user.role === "worker") {
    const [worker] = await db.select({ id: workers.id }).from(workers).where(and(eq(workers.userId, user.id), eq(workers.isActive, true))).limit(1);
    if (!worker || worker.id !== token.workerId) return null;
    workerId = worker.id;
  }
  return { id: user.id, userId: user.id, name: user.name, role: user.role, workerId, expiresAt: token.expiresAt };
}

export async function requireStaff(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) throw new AuthError(401, "লগইন করে আবার চেষ্টা করুন");
  return session;
}

export async function requireAdmin(): Promise<StaffSession> {
  const session = await requireStaff();
  if (!isAdminRole(session.role)) throw new AuthError(403, "এই কাজের অনুমতি নেই");
  return session;
}

export async function requireOwnerOrManager(): Promise<StaffSession> {
  const session = await requireAdmin();
  if (!["owner", "manager"].includes(session.role)) throw new AuthError(403, "শুধু মালিক বা ম্যানেজার এই কাজ করতে পারেন");
  return session;
}

export async function requireWorker(): Promise<StaffSession & { workerId: string }> {
  const session = await requireStaff();
  if (session.role !== "worker" || !session.workerId) throw new AuthError(403, "কারিগরের অ্যাকাউন্ট দিয়ে লগইন করুন");
  return { ...session, workerId: session.workerId };
}

export async function getCustomerSession(): Promise<{ customerId: string } | null> {
  const id = unsign((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id || !UUID.test(id)) return null;
  const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, id), eq(customers.portalEnabled, true), eq(customers.isActive, true))).limit(1);
  return customer ? { customerId: customer.id } : null;
}

export async function requireCustomerSession(): Promise<{ customerId: string }> {
  const session = await getCustomerSession();
  if (!session) throw new AuthError(401, "কাস্টমার পোর্টালে লগইন করুন");
  return session;
}

export function authErrorResponse(error: unknown): NextResponse | null {
  return error instanceof AuthError ? NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status }) : null;
}
