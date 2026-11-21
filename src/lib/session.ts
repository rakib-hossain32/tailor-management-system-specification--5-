import { readSession, signSession } from "@/lib/auth";

export const SESSION_COOKIE = "portal_session";

/** Customer cookies have a distinct purpose and an expiry inside the signed payload. */
export function sign(customerId: string): string {
  return signSession({ customerId }, "customer");
}

export function unsign(token: string | undefined | null): string | null {
  const data = readSession(token, "customer");
  return data && typeof data.customerId === "string" ? data.customerId : null;
}
