/**
 * Printed-card barcode codes.
 *
 * Cards no longer print a QR code: a QR encodes a URL, and anyone who
 * photographs it walks away with a link. A barcode instead carries
 * ONLY a 12-digit number — meaningless on its own. Staff scan it with
 * the in-app barcode scanner (or type the number), the server resolves
 * the number to the record, and the record opens only inside a staff
 * session. Nothing on the paper points anywhere.
 *
 * The code is derived deterministically from the record's UUID
 * (the UUID as a big integer, mod 10^12), so every existing appointment
 * and customer already has one — no migration, nothing to store.
 * Resolution scans the id list and compares codes; at single-shop
 * scale that is a few hundred comparisons, and a 12-digit space makes
 * an accidental collision effectively impossible.
 */
export function recordCode(id: string): string {
  const hex = id.replace(/[^a-f0-9]/gi, "").toLowerCase();
  if (hex.length < 8) return "000000000000";
  // (UUID as a big integer) mod 10^12, computed digit by digit so it
  // never needs BigInt: acc stays below 10^12, acc * 16 + 15 < 2^53.
  let acc = 0;
  for (const ch of hex) {
    acc = (acc * 16 + parseInt(ch, 16)) % 1_000_000_000_000;
  }
  return acc.toString().padStart(12, "0");
}

/** "123456789012" → "1234 5678 9012" for the human-readable print line. */
export function formatRecordCode(code: string): string {
  return code.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Normalize a scanned/typed value down to its digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}
