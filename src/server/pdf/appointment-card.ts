import "server-only";
import { eq } from "drizzle-orm";
import * as bwipjs from "bwip-js/node";
import { db } from "@/db";
import { appointments, customers } from "@/db/schema";
import { viewFields } from "@/server/repositories/views";
import { garmentsOfAppointment } from "@/server/services/appointment-garments";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { dateBn, formatPhone } from "@/lib/format";
import { toBnDigits } from "@/lib/units";
import { recordCode, formatRecordCode } from "@/lib/barcode";
import {
  DARK,
  GRAY,
  INK,
  drawField,
  drawPrintText,
  drawRule,
  renderDynamicPdf,
} from "./receipt";

/**
 * Appointment slip PDF — PORTRAIT, 68 mm wide: the long side is about
 * the length of an adult index finger (শাহাদাত আঙুল), standing upright
 * like one — never landscape.
 *
 * The owner's print rules (see ./receipt): Tiro Bangla on paper,
 * black on white only, and EXACTLY ONE PAGE always — the page height
 * is measured from the content, so a long address or note makes a
 * longer slip instead of a second page. All text goes through
 * drawPrintText (the াঁ/োঁ cluster fallback lives there).
 *
 * EVERYTHING the customer submitted is on the slip: name, phone, date,
 * time, purpose, the garments they want made, shop visit or home visit
 * with the full address, and their note — nothing is dropped. Each
 * field is a small gray label ABOVE a clearly larger black value.
 *
 * No QR code: the slip prints a Code128 BARCODE holding only a
 * 12-digit record number (lib/barcode). A QR would hand anyone who
 * photographs the card a working URL; a number alone opens nothing —
 * staff scan it with the in-app barcode scanner and the record opens
 * only inside their staff session.
 */

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

// 68 mm wide in PostScript points (the owner asked for a slightly
// sturdier slip than the first 52 mm cut); height starts at 80 mm
// (finger length) and grows with the content — see renderDynamicPdf.
const PAGE_W = 192.8;
const MIN_H = 226.8;

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

  const buffer = await renderDynamicPdf({
    width: PAGE_W,
    minHeight: MIN_H,
    draw: (doc, fonts) => {
      const M = 12; // side margin
      const W = PAGE_W - M * 2; // content width ≈ 168.8pt
      let y = 9;

      // ── header: shop name centered, phone under it, strong rule ──
      y = drawPrintText(doc, fonts, shopName, M, y, { width: W, size: 13, color: INK, align: "center" }) + 1;
      if (shopPhone) {
        drawPrintText(doc, fonts, shopPhone, M, y, { width: W, size: 9, color: DARK, align: "center", lineBreak: false });
        y += 12;
      }
      y = drawRule(doc, M, y, W, 1.4, INK) + 3;
      drawPrintText(doc, fonts, "অ্যাপয়েন্টমেন্ট স্লিপ", M, y, { width: W - 40, size: 8, color: GRAY, lineBreak: false });
      drawPrintText(doc, fonts, status, M, y, { width: W, size: 8, color: GRAY, align: "right", lineBreak: false });
      y += 11;
      y = drawRule(doc, M, y, W) + 6;

      // ── customer: label above a large name, phone under it ──
      drawPrintText(doc, fonts, "কাস্টমার", M, y, { width: W, size: 7.5, color: GRAY, lineBreak: false });
      y += 10;
      y = drawPrintText(doc, fonts, a.name, M, y, { width: W, size: 12, color: INK }) + 1;
      drawPrintText(doc, fonts, toBnDigits(formatPhone(a.phone)), M, y, { width: W, size: 10.5, color: DARK, lineBreak: false });
      y += 14;
      y = drawRule(doc, M, y, W) + 6;

      // ── every submitted field, stacked label → value ──
      const field = (label: string, value: string) => {
        y = drawField(doc, fonts, label, value, M, y, W) + 4;
      };
      field("তারিখ", toBnDigits(dateBn(start)));
      field("সময়", `${timeLabel(start)} – ${timeLabel(end)}`);
      field("উদ্দেশ্য", a.purpose);
      if (garments.length) field("কী বানাতে চান", garments.join(", "));
      field("ভিজিট", homeVisit ? "হোম ভিজিট (বাসায়)" : "দোকানে আসবেন");
      if (homeVisit && a.address) field("ঠিকানা", a.address);
      if (a.notes) field("নোট", a.notes);

      // ── barcode block at the foot of the content ──
      y = drawRule(doc, M, y + 1, W) + 5;
      doc.image(barcode, M, y, { width: W, height: 16 });
      y += 20;
      drawPrintText(doc, fonts, toBnDigits(formatRecordCode(code)), M, y, {
        width: W,
        size: 10.5,
        color: INK,
        align: "center",
        characterSpacing: 1.6,
        lineBreak: false,
      });
      y += 14;
      drawPrintText(doc, fonts, "আসার সময় এই স্লিপটি সঙ্গে আনুন", M, y, {
        width: W,
        size: 7.5,
        color: GRAY,
        align: "center",
        lineBreak: false,
      });
      return y + 10;
    },
  });

  return { buffer, fileName: `appointment-${a.id.slice(0, 8)}.pdf` };
}
