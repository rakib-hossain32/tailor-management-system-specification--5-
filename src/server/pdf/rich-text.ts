import type PDFDocument from "pdfkit";

type Doc = InstanceType<typeof PDFDocument>;

/**
 * Mixed-font text for the printed cards (owner's three-font rule, print
 * edition): ordinary writing renders in the base Bengali face (Hind
 * Siliguri), while every NUMBER — a run containing Bengali or Latin
 * digits, the taka sign, and the punctuation that belongs to a number
 * (১১:৩০, ২৭/১১, ১,৫০০) — renders in Tiro Bangla.
 *
 * PDFKit has no per-character font fallback, so the string is split
 * into digit runs and letter runs here and emitted as one continued
 * text flow; wrapping and alignment behave as for a single text call.
 */

export interface RichFonts {
  /** Writing face — Hind Siliguri. */
  base: string;
  /** Number face — Tiro Bangla. */
  digits: string;
}

const DIGIT_RUN = /[0-9০-৯৳]+(?:[.,:+\-/][0-9০-৯]+)*/g;

interface Segment {
  text: string;
  digits: boolean;
}

export function splitByDigits(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(DIGIT_RUN)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ text: text.slice(last, index), digits: false });
    out.push({ text: m[0], digits: true });
    last = index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), digits: false });
  return out.filter((s) => s.text.length > 0);
}

export interface RichTextOptions {
  width: number;
  size: number;
  color: string;
  fonts: RichFonts;
  align?: "left" | "center" | "right";
  lineGap?: number;
}

export interface LabeledValueOptions {
  width: number;
  fonts: RichFonts;
  labelSize: number;
  valueSize: number;
  labelColor: string;
  valueColor: string;
  lineGap?: number;
}

/**
 * One receipt-style field: a small gray label and the value on the
 * SAME line (the value wraps to the full width when long), digits in
 * the digits font. Returns the y below the field.
 */
export function drawLabeledValue(
  doc: Doc,
  label: string,
  value: string,
  x: number,
  y: number,
  opts: LabeledValueOptions,
): number {
  const segments = splitByDigits(value);
  doc.font(opts.fonts.base).fontSize(opts.labelSize).fillColor(opts.labelColor);
  doc.text(`${label}  `, x, y, { width: opts.width, lineGap: opts.lineGap ?? 0.5, continued: segments.length > 0 });
  doc.fontSize(opts.valueSize).fillColor(opts.valueColor);
  segments.forEach((seg, i) => {
    doc.font(seg.digits ? opts.fonts.digits : opts.fonts.base);
    doc.text(seg.text, { continued: i < segments.length - 1 });
  });
  if (!segments.length) doc.text("", {});
  return doc.y;
}

/**
 * Draw `text` at (x, y) with digit runs in the digits font; returns the
 * y just below the drawn block (doc.y), so callers can stack rows.
 */
export function drawRichText(doc: Doc, text: string, x: number, y: number, opts: RichTextOptions): number {
  const segments = splitByDigits(text);
  if (!segments.length) return y;
  doc.fontSize(opts.size).fillColor(opts.color);
  segments.forEach((seg, i) => {
    const first = i === 0;
    const lastSeg = i === segments.length - 1;
    doc.font(seg.digits ? opts.fonts.digits : opts.fonts.base);
    if (first) {
      doc.text(seg.text, x, y, {
        width: opts.width,
        align: opts.align ?? "left",
        lineGap: opts.lineGap ?? 1.5,
        continued: !lastSeg,
      });
    } else {
      doc.text(seg.text, { continued: !lastSeg });
    }
  });
  return doc.y;
}
