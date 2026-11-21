import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const STAFF_COOKIE = "staff_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const ADMIN_ROLES = ["owner", "manager", "reception", "master"];

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return secret;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || password.length > 256) return false;
  const [format, salt, hash] = stored.split("$");
  if (format !== "scrypt" || !/^[a-f0-9]{32}$/i.test(salt ?? "") || !/^[a-f0-9]{128}$/i.test(hash ?? "")) return false;
  try {
    return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function signSession(payload: Record<string, unknown>, purpose: "staff" | "customer"): string {
  const value = Buffer.from(JSON.stringify({ ...payload, purpose, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })).toString("base64url");
  const signature = createHmac("sha256", authSecret()).update(value).digest("base64url");
  return `${value}.${signature}`;
}

export function readSession(token: string | null | undefined, purpose: "staff" | "customer"): Record<string, unknown> | null {
  if (!token || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const expected = createHmac("sha256", authSecret()).update(parts[0]).digest();
    const signature = Buffer.from(parts[1], "base64url");
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
    const payload: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const data = payload as Record<string, unknown>;
    if (data.purpose !== purpose || typeof data.exp !== "number" || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function createStaffSession(userId: string, role: string, workerId?: string | null): string {
  return signSession({ userId, role, workerId: workerId ?? null }, "staff");
}

export function readStaffSession(token: string | undefined | null): { userId: string; role: string; workerId: string | null; expiresAt: number } | null {
  const data = readSession(token, "staff");
  if (!data || typeof data.userId !== "string" || typeof data.role !== "string") return null;
  return { userId: data.userId, role: data.role, workerId: typeof data.workerId === "string" ? data.workerId : null, expiresAt: Number(data.exp) };
}
