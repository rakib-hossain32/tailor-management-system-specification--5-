/**
 * Unit handling for measurements.
 *
 * Invariant (PRD 4.4): the database always stores centimetres with 2 decimals.
 * The UI may render inch or cm, and must accept Bengali digits as well as
 * fraction glyphs (১৫½, 15 1/2, 15.75).
 */

export type Unit = "inch" | "cm";

export const CM_PER_INCH = 2.54;

const BN_TO_ASCII: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
  "।": ".",
};

const FRACTION_GLYPHS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const FRACTION_GLYPH_BY_VALUE: [number, string][] = [
  [0.875, "⅞"],
  [0.75, "¾"],
  [0.625, "⅝"],
  [0.5, "½"],
  [0.375, "⅜"],
  [0.25, "¼"],
  [0.125, "⅛"],
];

/** Replace Bengali numerals with ASCII ones. */
export function normalizeDigits(input: string): string {
  return input.replace(/[০-৯।]/g, (ch) => BN_TO_ASCII[ch] ?? ch);
}

export function toBnDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}

/**
 * Parse a human measurement entry into a number in the *entered* unit.
 * Accepts: "38", "৩৮", "38.5", "15½", "15 1/2", "১৫ ১/২", "-3" (invalid → NaN)
 */
export function parseMeasurementInput(raw: string): number {
  if (raw == null) return NaN;
  const normalized = normalizeDigits(String(raw)).trim().replace(/\s+/g, " ");
  if (normalized === "") return NaN;

  // pure glyph fraction: 15½ / ½
  const glyphMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*([½¼¾⅓⅔⅛⅜⅝⅞])$/);
  if (glyphMatch) {
    return parseFloat(glyphMatch[1]) + FRACTION_GLYPHS[glyphMatch[2]];
  }
  const onlyGlyph = FRACTION_GLYPHS[normalized];
  if (onlyGlyph !== undefined) return onlyGlyph;

  // a b/c
  const slashMatch = normalized.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (slashMatch) {
    const denom = parseFloat(slashMatch[3]);
    if (denom === 0) return NaN;
    return parseFloat(slashMatch[1]) + parseFloat(slashMatch[2]) / denom;
  }
  const pureSlash = normalized.match(/^(\d+)\/(\d+)$/);
  if (pureSlash) {
    const denom = parseFloat(pureSlash[2]);
    if (denom === 0) return NaN;
    return parseFloat(pureSlash[1]) / denom;
  }

  const asNumber = Number(normalized);
  return Number.isFinite(asNumber) ? asNumber : NaN;
}

export function inchToCm(inch: number): number {
  return round2(inch * CM_PER_INCH);
}

export function cmToInch(cm: number): number {
  return cm / CM_PER_INCH;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert a value expressed in `unit` into storage centimetres. */
export function toCm(value: number, unit: Unit): number {
  return unit === "inch" ? inchToCm(value) : round2(value);
}

/** Convert a stored centimetre value into the display unit. */
export function fromCm(cm: number, unit: Unit): number {
  return unit === "inch" ? round2(cmToInch(cm) * 1000) / 1000 : cm;
}

/** Format an inch value as a tailor would write it: 15½, 15¾, 16.25 → 16¼ */
export function formatInch(inch: number): string {
  if (!Number.isFinite(inch)) return "—";
  const sign = inch < 0 ? "-" : "";
  const abs = Math.abs(inch);
  const whole = Math.floor(abs + 1e-9);
  const frac = abs - whole;
  const eighth = Math.round(frac * 8) / 8;
  if (eighth >= 0.999) return `${sign}${whole + 1}`;
  if (eighth < 0.0001) return `${sign}${whole}`;
  const glyph = FRACTION_GLYPH_BY_VALUE.find(([v]) => Math.abs(v - eighth) < 0.001);
  if (glyph) return `${sign}${whole}${glyph[1]}`;
  return `${sign}${(Math.round(abs * 100) / 100).toString()}`;
}

/** Display a stored cm value in the requested unit. */
export function formatMeasurement(cm: number | null | undefined, unit: Unit): string {
  if (cm == null || !Number.isFinite(cm)) return "—";
  if (unit === "inch") return formatInch(cmToInch(cm));
  return (Math.round(cm * 100) / 100).toString();
}

/** Delta between two stored cm values, rendered in the display unit. */
export function formatDelta(deltaCm: number, unit: Unit): string {
  const value = unit === "inch" ? cmToInch(deltaCm) : deltaCm;
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded) < 0.005) return "সমান";
  const abs =
    unit === "inch" ? formatInch(Math.abs(rounded)) : String(Math.abs(rounded));
  return `${rounded > 0 ? "+" : "−"}${abs}`;
}

export const QUICK_FRACTIONS: { label: string; value: number }[] = [
  { label: "¼", value: 0.25 },
  { label: "½", value: 0.5 },
  { label: "¾", value: 0.75 },
];
