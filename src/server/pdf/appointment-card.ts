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
import { drawLabeledValue, drawRichText, type RichFonts } from "./rich-text";

/**
 * Appointment card PDF — a small white slip in PORTRAIT, 52 × 80 mm:
 * the long side (80 mm) is about the length of an adult index finger
 * (শাহাদাত আঙুল), standing upright like one — never landscape.
 *
 * Deliberately BLACK ON WHITE ONLY: no color fills, no bands, no gold —
 * the owner prints hundreds of these and color would burn ink and
 * money. Hairline rules and typography carry the design instead.
 *
 * EVERYTHING the customer submitted is on the slip: name, phone, date,
 * time, purpose, the garments they want made, shop visit or home visit
 * with the full address, and their note — nothing is dropped.
 *
 * Fonts follow the owner's three-font rule, print edition: writing in
 * Hind Siliguri, every NUMBER in Tiro Bangla (see ./rich-text), and
 * the barcode number in Tiro Bangla with Bengali digits.
 *
 * No QR code: the slip prints a Code128 BARCODE holding only a
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

// 52 mm × 80 mm in PostScript points — portrait, finger-length.
const PAGE_W = 147.4;
const PAGE_H = 226.8;

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
  const shopPhone = shop.phone ? toBnDigits(formatPhone(shop.phone)) : "";
  const status = STATUS_LABEL[a.status] ?? a.status;
  const homeVisit = a.locationType === "home";

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, compress: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const regular = fontPath("HindSiliguri-Regular.ttf");
    const semiBold = fontPath("HindSiliguri-SemiBold.ttf");
    const tiro = fontPath("TiroBangla-Regular.ttf");
    if (existsSync(regular)) doc.registerFont("bn", regular);
    if (existsSync(semiBold)) doc.registerFont("bn-bold", semiBold);
    if (existsSync(tiro)) doc.registerFont("tiro", tiro);
    const BN = existsSync(regular) ? "bn" : "Helvetica";
    const BNB = existsSync(semiBold) ? "bn-bold" : BN;
    // Numbers in Tiro Bangla; if the TTF has not been added to
    // public/fonts yet, digits fall back to Hind Siliguri — the slip
    // still prints correctly instead of failing.
    const fonts: RichFonts = { base: BN, digits: existsSync(tiro) ? "tiro" : BN };

    const M = 9; // side margin
    const W = PAGE_W - M * 2; // content width ≈ 129.4pt
    let y = 7;

    // ── header: shop name left, status right, hairline below ──
    doc.font(BNB).fontSize(11.5).fillColor(BLACK);
    doc.text(shopName, M, y, { width: W - 34, lineBreak: false, ellipsis: true });
    doc.font(BN).fontSize(7.5).fillColor(DARK);
    doc.text(status, M, y + 2, { width: W, align: "right", lineBreak: false });
    y += 15;
    doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(HAIR).lineWidth(0.6).stroke();
    y += 5;

    // ── customer: name (bold, left) + phone (right) on one line ──
    doc.font(BNB).fontSize(11).fillColor(BLACK);
    doc.text(a.name, M, y, { width: W - 58, lineBreak: false, ellipsis: true });
    drawRichText(doc, toBnDigits(formatPhone(a.phone)), M, y + 1, {
      width: W,
      size: 9.5,
      color: DARK,
      fonts,
      align: "right",
    });
    y = Math.max(y + 15, doc.y);

    // ── fields: every submitted field, nothing dropped ──
    const field = (label: string, value: string) => {
      y = drawLabeledValue(doc, label, value, M, y, {
        width: W,
        fonts,
        labelSize: 7,
        valueSize: 9,
        labelColor: GRAY,
        valueColor: BLACK,
      });
      y += 2;
    };

    field("তারিখ", toBnDigits(dateBn(start)));
    field("সময়", `${timeLabel(start)} – ${timeLabel(end)}`);
    field("উদ্দেশ্য", a.purpose);
    if (garments.length) field("কী বানাতে চান", garments.join(", "));
    field("ভিজিট", homeVisit ? "হোম ভিজিট (বাসায়)" : "দোকানে আসবেন");
    if (homeVisit && a.address) field("ঠিকানা", a.address);
    if (a.notes) field("নোট", a.notes);

    // ── barcode block, anchored toward the foot of the slip ──
    y = Math.max(y + 3, PAGE_H - 56);
    doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(HAIR).lineWidth(0.6).stroke();
    y += 4.5;
    doc.image(barcode, M, y, { width: W, height: 16 });
    y += 20;
    // The human-readable code: Bengali digits in Tiro Bangla (the
    // scanner reads the bars; staff can also type the number — the
    // by-code lookup accepts Bengali digits).
    doc.font(fonts.digits).fontSize(10).fillColor(BLACK);
    doc.text(toBnDigits(formatRecordCode(code)), M, y, {
      width: W,
      align: "center",
      characterSpacing: 1.6,
      lineBreak: false,
    });
    y = doc.y + 1.5;
    doc.font(BN).fontSize(6.5).fillColor(GRAY);
    doc.text(shopPhone ? `${shopName} · ${shopPhone}` : "আসার সময় এই স্লিপটি সঙ্গে আনুন", M, y, {
      width: W,
      align: "center",
      lineBreak: false,
    });

    doc.end();
  });

  return { buffer, fileName: `appointment-${a.id.slice(0, 8)}.pdf` };
}
