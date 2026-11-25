import { createHmac, timingSafeEqual } from "node:crypto";
import { authSecret } from "@/lib/auth";

/**
 * Signed scan tokens for the appointment-card QR code.
 *
 * The QR URL is /scan/<appointmentId>?t=<token>, where the token is a
 * truncated HMAC-SHA256 of the appointment id keyed by the server-only
 * AUTH_SECRET. Consequences:
 *  - Nobody can guess or script-generate a valid scan URL for another
 *    appointment — the id alone is worthless without the secret.
 *  - A forwarded/photographed link still needs a staff login on top
 *    (the scan page checks the session before showing anything).
 *  - Verification is timing-safe, and bad tokens get a plain 404.
 */
export function signScanToken(appointmentId: string): string {
  return createHmac("sha256", authSecret())
    .update(`scan:${appointmentId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyScanToken(appointmentId: string, token: string | null | undefined): boolean {
  if (!token || token.length > 64) return false;
  const expected = Buffer.from(signScanToken(appointmentId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
