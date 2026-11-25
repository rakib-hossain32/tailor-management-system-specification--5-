import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";

type Doc = InstanceType<typeof PDFDocument>;

/**
 * Shared print-PDF foundation for every TailorPro document
 * (appointment slip, cash memo, measurement card, payroll sheet).
 *
 * The owner's print rules, applied uniformly:
 *  - Tiro Bangla is the print face — writing AND numbers.
 *  - BLACK ON WHITE ONLY: no color fills, no bands — hairline rules
 *    and typography carry the design, and bulk printing stays cheap.
 *  - EXACTLY ONE PAGE, ALWAYS: the page is measured first and its
 *    height grows with the content (a longer address or note makes a
 *    longer slip) instead of spilling onto a second page.
 *
 * ⚠ FONTKIT LANDMINE (found the hard way — it hung the whole server
 * with a heap OOM): Tiro Bangla + fontkit loops FOREVER laying out a
 * consonant cluster ending in া/ো + ঁ (candrabindu) — কাঁধ, বাঁশ,
 * খোঁজ, চাঁদ… — even for a single line, even in widthOfString. Those
 * words are NOT rare here (কাঁধ is the shoulder measurement label!).
 * Hind Siliguri shapes the same clusters correctly, so text is split
 * into word segments below: a word containing াঁ/োঁ is drawn in Hind
 * Siliguri, everything else in Tiro Bangla. NEVER pass raw text to
 * doc.text/widthOfString/heightOfString in a PDF builder — always go
 * through drawPrintText / printWidth / printHeight here.
 */

export const INK = "#000000";
export const DARK = "#2B2B2B";
export const GRAY = "#6E6E6E";
export const HAIR = "#A8A8A8";
export const FAINT = "#D9D9D9";

export interface PrintFonts {
  /** Main print face — Tiro Bangla. */
  main: string;
  /** Cluster-safe fallback — Hind Siliguri. */
  fallback: string;
}

const MAIN = "tiro";
const FALLBACK = "hind";

function fontFile(file: string): string {
  return join(process.cwd(), "public", "fonts", file);
}

/** Register the print fonts on a document; returns their handles. */
export function registerPrintFonts(doc: Doc): PrintFonts {
  const tiro = fontFile("TiroBangla-Regular.ttf");
  const hind = fontFile("HindSiliguri-Regular.ttf");
  const hasTiro = existsSync(tiro);
  const hasHind = existsSync(hind);
  if (hasTiro) doc.registerFont(MAIN, tiro);
  if (hasHind) doc.registerFont(FALLBACK, hind);
  if (hasTiro && hasHind) return { main: MAIN, fallback: FALLBACK };
  if (hasTiro) return { main: MAIN, fallback: MAIN };
  if (hasHind) return { main: FALLBACK, fallback: FALLBACK };
  return { main: "Helvetica", fallback: "Helvetica" };
}

/** A word is print-unsafe in Tiro when it carries াঁ or োঁ. */
const UNSAFE_WORD = /[াো]ঁ/;

interface Segment {
  text: string;
  font: string;
}

/**
 * Split text into font segments at word boundaries: unsafe words go
 * to the fallback face, everything else (including spaces) stays in
 * the main face. Drawn as one continued flow, so wrapping/alignment
 * behave like a single text call.
 */
export function splitPrintSegments(text: string, fonts: PrintFonts): Segment[] {
  if (fonts.main === fonts.fallback) return [{ text, font: fonts.main }];
  const parts = text.split(/(\s+)/);
  const out: Segment[] = [];
  for (const part of parts) {
    if (!part) continue;
    const font = UNSAFE_WORD.test(part) ? fonts.fallback : fonts.main;
    const last = out[out.length - 1];
    if (last && last.font === font) last.text += part;
    else out.push({ text: part, font });
  }
  return out.length ? out : [{ text: "", font: fonts.main }];
}

export interface PrintTextOptions {
  width: number;
  size: number;
  color: string;
  align?: "left" | "center" | "right";
  lineGap?: number;
  lineBreak?: boolean;
  characterSpacing?: number;
  ellipsis?: boolean;
}

/**
 * Draw text at (x, y) through the segment splitter — the ONLY way
 * builders may emit text. Returns the y just below the block.
 */
export function drawPrintText(
  doc: Doc,
  fonts: PrintFonts,
  text: string,
  x: number,
  y: number,
  opts: PrintTextOptions,
): number {
  const segments = splitPrintSegments(text, fonts);
  doc.fontSize(opts.size).fillColor(opts.color);
  segments.forEach((seg, i) => {
    const first = i === 0;
    const lastSeg = i === segments.length - 1;
    doc.font(seg.font);
    if (first) {
      doc.text(seg.text, x, y, {
        width: opts.width,
        align: opts.align ?? "left",
        lineGap: opts.lineGap ?? 1.5,
        lineBreak: opts.lineBreak ?? true,
        characterSpacing: opts.characterSpacing,
        ellipsis: opts.ellipsis,
        continued: !lastSeg,
      });
    } else {
      doc.text(seg.text, { continued: !lastSeg });
    }
  });
  return doc.y;
}

/** Width of a string with per-segment fonts (never hangs). */
export function printWidth(doc: Doc, fonts: PrintFonts, text: string, size: number): number {
  return splitPrintSegments(text, fonts).reduce((sum, seg) => {
    doc.font(seg.font).fontSize(size);
    return sum + doc.widthOfString(seg.text);
  }, 0);
}

/**
 * Height of a wrapped paragraph, simulated word by word with
 * per-segment fonts (doc.heightOfString would hang on unsafe words).
 * Uses the larger of the two faces' line heights, like the real flow.
 */
export function printHeight(
  doc: Doc,
  fonts: PrintFonts,
  text: string,
  size: number,
  width: number,
  lineGap = 1.5,
): number {
  doc.font(fonts.main).fontSize(size);
  const mainLine = doc.currentLineHeight();
  doc.font(fonts.fallback).fontSize(size);
  const lineHeight = Math.max(mainLine, doc.currentLineHeight()) + lineGap;
  const words = text.split(/(\s+)/).filter((w) => w.length > 0);
  let lines = 1;
  let lineWidth = 0;
  for (const word of words) {
    const w = printWidth(doc, fonts, word, size);
    if (lineWidth > 0 && lineWidth + w > width) {
      lines += 1;
      lineWidth = /^\s+$/.test(word) ? 0 : w;
    } else {
      lineWidth += w;
    }
  }
  return lines * lineHeight;
}

/**
 * One stacked field: a small gray label ABOVE a clearly larger black
 * value (the value wraps to the full width when long). Returns the y
 * below the value.
 */
export function drawField(
  doc: Doc,
  fonts: PrintFonts,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
): number {
  drawPrintText(doc, fonts, label, x, y, { width, size: 7.5, color: GRAY, lineBreak: false });
  return drawPrintText(doc, fonts, value, x, y + 10, { width, size: 10.5, color: INK });
}

/** A horizontal hairline rule; returns the y of the line. */
export function drawRule(doc: Doc, x: number, y: number, width: number, weight = 0.6, color = HAIR): number {
  doc.moveTo(x, y).lineTo(x + width, y).strokeColor(color).lineWidth(weight).stroke();
  return y;
}

export interface DynamicPdfOptions {
  /** Page width in points. */
  width: number;
  /** The page is never shorter than this (points). */
  minHeight: number;
  /** Extra breathing room appended below the measured content. */
  bottomPad?: number;
  /**
   * Draw the whole document and return the y just below the last
   * element. Must be pure — it runs twice (measure, then render).
   */
  draw: (doc: Doc, fonts: PrintFonts) => number;
}

/**
 * Two-pass render: measure the content on a very tall page, then
 * render for real on a page exactly as tall as the content needs
 * (never below minHeight). The result is always a single page.
 */
export async function renderDynamicPdf(opts: DynamicPdfOptions): Promise<Buffer> {
  const measure = new PDFDocument({ size: [opts.width, 6000], margin: 0 });
  const measureFonts = registerPrintFonts(measure);
  const endY = opts.draw(measure, measureFonts);
  measure.end();

  const height = Math.max(opts.minHeight, Math.ceil(endY + (opts.bottomPad ?? 10)));
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: [opts.width, height], margin: 0, compress: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const fonts = registerPrintFonts(doc);
    opts.draw(doc, fonts);
    doc.end();
  });
}
