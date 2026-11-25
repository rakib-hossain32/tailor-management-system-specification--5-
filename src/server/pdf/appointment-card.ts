import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { db } from "@/db";
import { appointments, customers } from "@/db/schema";
import { viewFields } from "@/server/repositories/views";
import { garmentsOfAppointment } from "@/server/services/appointment-garments";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { dateBn, formatPhone } from "@/lib/format";
import { toBnDigits } from "@/lib/units";
import { signScanToken } from "@/lib/scan-token";

/**
 * Appointment card PDF — generated on the server with PDFKit.
 * True vector text (never a screenshot), so it stays perfectly sharp at
 * any zoom or print size. The API route streams it as an attachment:
 * one click on "Download" saves the file, no preview page in between.
 */

const INK = "#0F1A2C";
const INK3 = "#4A586E";
const STONE = "#7C7569";
const GOLD = "#C9961A";
const GOLD_DARK = "#7D5B06";
const GOLD_LIGHT = "#F6E7BE";
const PAPER = "#FFFCF6";
const LINE = "#E3DCCB";

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

export async function buildAppointmentCardPdf(
  id: string,
  origin: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  if (!/^[a-f\d-]{36}$/i.test(id)) return null;
  const rows = await db
    .select({ a: viewFields(appointments), c: viewFields(customers) })
    .from(appointments)
    .leftJoin(customers, eq(appointments.customerId, customers.id))
    .where(eq(appointments.id, id))
    .limit(1);
  if (!rows.length) return null;
  const { a, c } = rows[0];

  const [{ shop }, garments] = await Promise.all([
    getPublicSiteSnapshot(),
    garmentsOfAppointment(a.id),
  ]);

  // The QR is for the SHOP, not the customer: it points at the staff scan
  // landing (/scan/<id>) with an HMAC-signed token (lib/scan-token) —
  // the bare id alone opens nothing, and the page additionally requires
  // a staff login (admin or worker) before showing any data.
  const target = `${origin}/scan/${a.id}?t=${signScanToken(a.id)}`;
  const qr = await QRCode.toBuffer(target, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
    color: { dark: "#142033", light: "#FFFFFF" },
  });

  const start = new Date(a.startsAt);
  const end = new Date(a.endsAt);
  const shopName = shop.nameBn || shop.nameEn || "টেইলর শপ";

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    // A6 portrait — a proper pocket appointment card.
    const doc = new PDFDocument({ size: [297.6, 419.5], margin: 0, compress: true });
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

    const W = 297.6;
    const M = 22; // side margin
    const CW = W - M * 2; // content width

    // ── page ──
    doc.rect(0, 0, W, 419.5).fill(PAPER);
    doc.rect(0, 0, W, 4).fill(GOLD);

    // ── footer strip (drawn first: absolute position, page bottom) ──
    doc.rect(0, 419.5 - 14, W, 14).fill(INK);
    doc.font(BN).fontSize(7).fillColor(GOLD);
    doc.text(
      shop.phone ? `${shopName} · হটলাইন ${toBnDigits(formatPhone(shop.phone))}` : shopName,
      0,
      419.5 - 13,
      { width: W, align: "center", characterSpacing: 0.5, lineBreak: false },
    );

    // ── header band ──
    doc.rect(0, 4, W, 76).fill(INK);
    doc.font(BNB).fontSize(17).fillColor("#FFFFFF");
    doc.text(shopName, M, 16, { width: CW - 86, lineBreak: false, ellipsis: true });
    doc.font(BN).fontSize(9).fillColor(GOLD);
    doc.text("অ্যাপয়েন্টমেন্ট কার্ড", M, 40, { width: CW - 86, characterSpacing: 0.6, lineBreak: false });
    if (shop.tagline) {
      doc.font(BN).fontSize(7.5).fillColor("#C9CEDA");
      doc.text(shop.tagline, M, 57, { width: CW - 86, lineBreak: false, ellipsis: true });
    }
    // status pill (no raw ids or codes printed anywhere on the card —
    // the signed QR carries the reference securely)
    const status = STATUS_LABEL[a.status] ?? a.status;
    doc.roundedRect(W - M - 74, 16, 74, 20, 10).fill(GOLD_LIGHT);
    doc.font(BNB).fontSize(9.5).fillColor(INK);
    doc.text(status, W - M - 74, 21.5, { width: 74, align: "center", lineBreak: false });
    doc.rect(0, 80, W, 2).fill(GOLD);

    let y = 98;

    // ── customer / purpose ──
    doc.font(BN).fontSize(7.5).fillColor(STONE);
    doc.text("কাস্টমার", M, y, { characterSpacing: 0.8 });
    doc.text("উদ্দেশ্য", M + CW / 2 + 6, y, { characterSpacing: 0.8 });
    y += 11;
    doc.font(BNB).fontSize(13.5).fillColor(INK);
    doc.text(a.name, M, y, { width: CW / 2 - 4, lineBreak: false, ellipsis: true });
    doc.font(BNB).fontSize(12).fillColor(INK);
    doc.text(a.purpose, M + CW / 2 + 6, y + 1, { width: CW / 2 - 6, lineBreak: false, ellipsis: true });
    y += 17;
    doc.font(BN).fontSize(10).fillColor(INK3);
    doc.text(toBnDigits(formatPhone(a.phone)), M, y);
    doc.font(BN).fontSize(9.5).fillColor(INK3);
    doc.text(a.locationType === "home" ? "হোম ভিজিট" : "শোরুমে", M + CW / 2 + 6, y, { width: CW / 2 - 6, lineBreak: false });
    y += 16;

    if (garments.length) {
      doc.font(BN).fontSize(7.5).fillColor(STONE);
      doc.text("কী বানাতে চান", M, y, { characterSpacing: 0.8 });
      y += 11;
      doc.font(BNB).fontSize(11).fillColor(GOLD_DARK);
      doc.text(garments.join("  ·  "), M, y, { width: CW });
      y += 15;
    }

    doc.moveTo(M, y + 2).lineTo(W - M, y + 2).strokeColor(LINE).lineWidth(0.7).stroke();
    y += 12;

    // ── schedule highlight ──
    doc.roundedRect(M, y, CW, 60, 7).fill(GOLD_LIGHT);
    doc.font(BN).fontSize(7.5).fillColor(GOLD_DARK);
    doc.text("সময়সূচি", M + 12, y + 8, { characterSpacing: 0.8, lineBreak: false });
    doc.font(BNB).fontSize(15).fillColor(INK);
    doc.text(toBnDigits(dateBn(start)), M + 12, y + 19, { width: CW - 24, lineBreak: false, ellipsis: true });
    doc.font(BNB).fontSize(11.5).fillColor(GOLD_DARK);
    doc.text(`${timeLabel(start)} – ${timeLabel(end)}`, M + 12, y + 41, { width: 150, lineBreak: false });
    doc.font(BN).fontSize(8).fillColor(INK3);
    doc.text("১০ মিনিট আগে আসুন", W - M - 132, y + 43, { width: 120, align: "right", lineBreak: false });
    y += 72;

    // ── address / notes — only real data, no boilerplate filler ──
    const extras: Array<[string, string]> = [];
    if (a.address) extras.push(["ঠিকানা", a.address]);
    if (a.notes) extras.push(["নোট", a.notes]);
    for (const [label, value] of extras) {
      doc.font(BN).fontSize(7.5).fillColor(STONE);
      doc.text(label, M, y, { characterSpacing: 0.8 });
      y += 11;
      doc.font(BN).fontSize(9.5).fillColor(INK3);
      const h = doc.heightOfString(value, { width: CW, lineGap: 1.5 });
      doc.text(value, M, y, { width: CW, lineGap: 1.5 });
      y += h + 9;
    }

    // ── QR + contact ──
    const qrSize = 74;
    const qrY = 419.5 - 24 - qrSize;
    doc.moveTo(M, qrY - 10).lineTo(W - M, qrY - 10).strokeColor(LINE).lineWidth(0.7).stroke();
    doc.image(qr, W - M - qrSize, qrY, { width: qrSize, height: qrSize });
    doc.font(BN).fontSize(7.5).fillColor(STONE);
    doc.text("দোকানে কার্ডটি দেখান", M, qrY + 2, { characterSpacing: 0.8 });
    doc.font(BN).fontSize(8.8).fillColor(INK3);
    doc.text("স্ক্যান করলেই আপনার মাপ ও অর্ডার খুলে যাবে।", M, qrY + 13, {
      width: CW - qrSize - 12,
      lineGap: 1.5,
    });
    doc.font(BN).fontSize(8.8).fillColor(INK3);
    const contact = [
      shop.phone ? `হটলাইন: ${toBnDigits(formatPhone(shop.phone))}` : "",
      shop.address ? shop.address.replace(/\n/g, ", ") : "",
    ].filter(Boolean).join("\n");
    doc.text(contact, M, qrY + 40, { width: CW - qrSize - 12, lineGap: 1.5 });

    doc.end();
  });

  return { buffer, fileName: `appointment-${a.id.slice(0, 8)}.pdf` };
}
