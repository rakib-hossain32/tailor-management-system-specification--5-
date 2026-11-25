import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import * as bwipjs from "bwip-js/node";
import { db } from "@/db";
import { appointments, customers } from "@/db/schema";
import { viewFields } from "@/server/repositories/views";
import { garmentsOfAppointment } from "@/server/services/appointment-garments";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { dateBn, formatPhone } from "@/lib/format";
import { toBnDigits } from "@/lib/units";
import { recordCode, formatRecordCode } from "@/lib/barcode";

/**
 * Appointment card PDF — a small white slip, 80 × 35 mm (about the
 * length of an index finger), generated on the server with PDFKit.
 *
 * Deliberately BLACK ON WHITE ONLY: no color fills, no bands, no gold —
 * the owner prints hundreds of these and color would burn ink and
 * money. Hairline rules and typography carry the design instead.
 *
 * No QR code either: the slip prints a Code128 BARCODE holding only a
 * 12-digit record number (lib/barcode). A QR would hand anyone who
 * photographs the card a working URL; a number alone opens nothing —
 * staff scan it with the in-app barcode scanner and the record opens
 * only inside their staff session.
 */

const BLACK = "#000000";
const DARK = "#333333";
const GRAY = "#6B6B6B";
const HAIR = "#9A9A9A";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "নিশ্চিত",
  booked: "বুকড",
  done: "সম্পন্ন",
  no_show: "এসেননি",
  cancelled: "বাতিল",
};

function timeLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? "সকাল" : h < 16 ? "দুপুর" : h < 19 ? "বিকাল" : "রাত";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${toBnDigits(h12)}:${toBnDigits(String(m).padStart(2, "0"))}`;
}

function fontPath(file: string): string {
  return join(process.cwd(), "public", "fonts", file);
}

// 80 mm × 35 mm in PostScript points.
const PAGE_W = 226.8;
const PAGE_H = 99.2;

export async function buildAppointmentCardPdf(
  id: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  if (!/^[a-f\d-]{36}$/i.test(id)) return null;
  const rows = await db
    .select({ a: viewFields(appointments), c: viewFields(customers) })
    .from(appointments)
    .leftJoin(customers, eq(appointments.customerId, customers.id))
    .where(eq(appointments.id, id))
    .limit(1);
  if (!rows.length) return null;
  const { a } = rows[0];

  const [{ shop }, garments] = await Promise.all([
    getPublicSiteSnapshot(),
    garmentsOfAppointment(a.id),
  ]);

  const code = recordCode(a.id);
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: code,
    scale: 6,
    height: 9,
    includetext: false,
    backgroundcolor: "FFFFFF",
    barcolor: "000000",
  });

  const start = new Date(a.startsAt);
  const end = new Date(a.endsAt);
  const shopName = shop.nameBn || shop.nameEn || "টেইলর শপ";
  const status = STATUS_LABEL[a.status] ?? a.status;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, compress: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const regular = fontPath("HindSiliguri-Regular.ttf");
    const semiBold = fontPath("HindSiliguri-SemiBold.ttf");
    if (existsSync(regular)) doc.registerFont("bn", regular);
    if (existsSync(semiBold)) doc.registerFont("bn-bold", semiBold);
    const BN = existsSync(regular) ? "bn" : "Helvetica";
    const BNB = existsSync(semiBold) ? "bn-bold" : BN;

    const M = 10; // side margin
    const W = PAGE_W - M * 2; // content width ≈ 206.8pt

    // ── header: shop name left, status right, hairline below ──
    doc.font(BNB).fontSize(10.5).fillColor(BLACK);
    doc.text(shopName, M, 7, { width: W - 52, lineBreak: false, ellipsis: true });
    doc.font(BN).fontSize(8).fillColor(DARK);
    doc.text(status, M, 8.5, { width: W, align: "right", lineBreak: false });
    doc.moveTo(M, 20).lineTo(PAGE_W - M, 20).strokeColor(HAIR).lineWidth(0.6).stroke();

    // ── customer line ──
    doc.font(BNB).fontSize(11).fillColor(BLACK);
    doc.text(a.name, M, 24, { width: 118, lineBreak: false, ellipsis: true });
    doc.font(BN).fontSize(9).fillColor(DARK);
    doc.text(toBnDigits(formatPhone(a.phone)), M + 122, 25.5, {
      width: W - 122,
      align: "right",
      lineBreak: false,
    });

    // ── schedule + purpose line ──
    doc.font(BNB).fontSize(9.5).fillColor(BLACK);
    const schedule = `${toBnDigits(dateBn(start))} · ${timeLabel(start)} – ${timeLabel(end)}`;
    doc.text(schedule, M, 39, { width: W, lineBreak: false, ellipsis: true });

    const detailParts = [
      a.purpose,
      garments.length ? garments.join(", ") : "",
      a.locationType === "home" ? "হোম ভিজিট" : "",
    ].filter(Boolean);
    doc.font(BN).fontSize(8.5).fillColor(GRAY);
    doc.text(detailParts.join(" · "), M, 51, { width: W, lineBreak: false, ellipsis: true });

    // ── barcode: full content width, number printed below ──
    doc.image(barcode, M, 64, { width: W, height: 20 });
    doc.font("Courier-Bold").fontSize(8).fillColor(BLACK);
    doc.text(formatRecordCode(code), M, 86, {
      width: W,
      align: "center",
      characterSpacing: 2.2,
      lineBreak: false,
    });

    doc.end();
  });

  return { buffer, fileName: `appointment-${a.id.slice(0, 8)}.pdf` };
}
