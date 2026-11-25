import "server-only";
import { desc as descOrd, eq } from "drizzle-orm";
import * as bwipjs from "bwip-js/node";
import { db } from "@/db";
import {
  customers,
  garmentTypes,
  measurementProfiles,
  measurementSets,
  orders,
  settings,
} from "@/db/schema";
import { viewFields } from "@/server/repositories/views";
import { getPinnedMeasurementSchemas } from "@/server/repositories/measurement-schema";
import { dateBn, dateShort, formatPhone } from "@/lib/format";
import { formatMeasurement, toBnDigits } from "@/lib/units";
import { flattenFields, type MeasurementSchema, type StyleSchema } from "@/lib/measurements";
import { statusMeta } from "@/lib/order-status";
import { recordCode, formatRecordCode } from "@/lib/barcode";
import {
  DARK,
  FAINT,
  GRAY,
  HAIR,
  INK,
  drawPrintText,
  drawRule,
  printWidth,
  renderDynamicPdf,
} from "./receipt";

/**
 * Measurement card PDF — server-generated with PDFKit (see ./receipt
 * for the shared print rules: Tiro Bangla on paper, black on white
 * only, exactly one page; all text via drawPrintText). 150 mm wide;
 * the height grows with the number of measurement fields instead of
 * spilling onto a second page.
 *
 * This replaces the old browser-print card page. The barcode is the
 * CUSTOMER's record code (lib/barcode) — staff scan it with the
 * in-app scanner and the customer hub opens; no URL on paper.
 */

const PAGE_W = 425.2; // 150 mm
const MIN_H = 340;

const SOURCE_BN: Record<string, string> = {
  in_store: "দোকানে মাপা",
  reused: "পুরনো মাপ",
  fit_adjusted: "ফিট-কারেকশন",
  from_garment: "পোশাক থেকে",
  self_reported: "স্ব-মাপ (যাচাই বাকি)",
  remote_assisted: "ভিডিও কলে মাপ",
  standard_size: "স্ট্যান্ডার্ড সাইজ",
};

export async function buildMeasurementCardPdf(
  id: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  if (!/^[a-f\d-]{36}$/i.test(id)) return null;
  const rows = await db
    .select({
      s: viewFields(measurementSets),
      p: viewFields(measurementProfiles),
      c: viewFields(customers),
      g: viewFields(garmentTypes),
    })
    .from(measurementSets)
    .innerJoin(measurementProfiles, eq(measurementSets.profileId, measurementProfiles.id))
    .innerJoin(customers, eq(measurementProfiles.customerId, customers.id))
    .innerJoin(garmentTypes, eq(measurementSets.garmentTypeId, garmentTypes.id))
    .where(eq(measurementSets.id, id))
    .limit(1);
  if (!rows.length) return null;
  const { s, p, c, g } = rows[0];

  const [shopRows, recentOrders] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, "shop")).limit(1),
    db
      .select({ o: viewFields(orders) })
      .from(orders)
      .where(eq(orders.customerId, c.id))
      .orderBy(descOrd(orders.createdAt))
      .limit(6),
  ]);
  const shop = (shopRows[0]?.value ?? {}) as Record<string, string>;

  const pinned = (await getPinnedMeasurementSchemas([s])).get(s.garmentSchemaVersionId)!;
  const schema = pinned.measurementSchema as unknown as MeasurementSchema;
  const styleSchema = pinned.styleSchema as unknown as StyleSchema;
  const fields = flattenFields(schema);
  const styles = (s.styles ?? {}) as Record<string, string>;
  const values = (s.values ?? {}) as Record<string, number>;
  const styleEntries = Object.entries(styles)
    .filter(([, v]) => v && v !== "none")
    .map(([k, v]) => {
      const opt = styleSchema.options.find((o) => o.key === k);
      const label = opt?.choices?.find((ch) => ch.value.trim() === v)?.label_bn ?? v;
      return { label: opt?.label_bn ?? k, value: label };
    });

  const custCode = recordCode(c.id);
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: custCode,
    scale: 5,
    height: 10,
    includetext: false,
    backgroundcolor: "FFFFFF",
    barcolor: "000000",
  });

  const shopName = shop.name_bn ?? "রহমান টেইলার্স";

  const buffer = await renderDynamicPdf({
    width: PAGE_W,
    minHeight: MIN_H,
    draw: (doc, fonts) => {
      const M = 24;
      const W = PAGE_W - M * 2;
      const T = (
        text: string,
        x: number,
        yy: number,
        opts: { width: number; size: number; color: string; align?: "left" | "center" | "right"; lineBreak?: boolean; lineGap?: number; ellipsis?: boolean },
      ) => drawPrintText(doc, fonts, text, x, yy, opts);
      let y = 22;

      // ── header ──
      T("মাপ কার্ড · Measurement Card", M, y, { width: W, size: 8.5, color: GRAY, lineBreak: false });
      const versionLabel = `সংস্করণ ${toBnDigits(String(s.version))}`;
      const vw = printWidth(doc, fonts, versionLabel, 10.5) + 14;
      doc.roundedRect(M + W - vw, y - 3, vw, 17, 3).strokeColor(INK).lineWidth(0.7).stroke();
      T(versionLabel, M + W - vw, y + 0.5, { width: vw, size: 10.5, color: INK, align: "center", lineBreak: false });
      y += 13;
      const nameB = T(shopName, M, y, { width: W - 90, size: 19, color: INK });
      let ly = nameB + 1;
      const shopLine = [shop.address, shop.phone ? `ফোন: ${toBnDigits(formatPhone(shop.phone))}` : null]
        .filter(Boolean)
        .join(" · ");
      if (shopLine) ly = T(shopLine, M, ly, { width: W - 90, size: 9.5, color: DARK, lineGap: 1.4 });
      T(`মাপের তারিখ: ${toBnDigits(dateShort(s.measuredAt))}`, M, y + 22, { width: W, size: 9.5, color: DARK, align: "right", lineBreak: false });
      y = Math.max(ly, y + 36) + 6;
      y = drawRule(doc, M, y, W, 1.6, INK) + 8;

      // ── customer (left) / profile + garment (right) ──
      const colW = W / 2 - 8;
      const rightX = M + W / 2 + 8;
      T("কাস্টমার", M, y, { width: colW, size: 8, color: GRAY, lineBreak: false });
      T("প্রোফাইল ও পোশাক", rightX, y, { width: colW, size: 8, color: GRAY, align: "right", lineBreak: false });
      y += 11;
      const custB = T(c.name, M, y, { width: colW, size: 13.5, color: INK });
      T(p.displayName, rightX, y + 1, { width: colW, size: 12, color: INK, align: "right", lineBreak: false });
      let cy = custB + 1;
      let ry = y + 16;
      T(toBnDigits(formatPhone(c.phone)), M, cy, { width: colW, size: 10.5, color: DARK, lineBreak: false });
      T(g.nameBn, rightX, ry, { width: colW, size: 10.5, color: DARK, align: "right", lineBreak: false });
      cy += 14;
      ry += 14;
      if (c.address) {
        cy = T(c.address, M, cy, { width: colW, size: 9.5, color: DARK, lineGap: 1.3 });
      }
      T(`${SOURCE_BN[s.source] ?? s.source}${s.verified ? " · যাচাইকৃত" : " · যাচাই বাকি"}`, rightX, ry, {
        width: colW,
        size: 9,
        color: GRAY,
        align: "right",
        lineBreak: false,
      });
      ry += 12;
      y = Math.max(cy, ry) + 5;
      y = drawRule(doc, M, y, W, 0.6, FAINT) + 7;

      // ── measurements grid (3 columns) ──
      T("মাপ (ইঞ্চি)", M, y, { width: W, size: 8.5, color: GRAY, lineBreak: false });
      y += 13;
      const cellW = (W - 24) / 3;
      fields.forEach((f, i) => {
        const col = i % 3;
        if (col === 0 && i > 0) y += 27;
        const cx = M + col * (cellW + 12);
        T(f.label_bn, cx, y, { width: cellW, size: 8.5, color: GRAY, lineBreak: false, ellipsis: true });
        T(toBnDigits(formatMeasurement(values[f.key], "inch")) || "—", cx, y + 10.5, { width: cellW, size: 12.5, color: INK, lineBreak: false });
        doc
          .moveTo(cx, y + 25)
          .lineTo(cx + cellW, y + 25)
          .strokeColor(FAINT)
          .lineWidth(0.5)
          .dash(2, { space: 2 })
          .stroke()
          .undash();
      });
      if (fields.length) y += 27;
      y += 4;

      // ── styles ──
      y = drawRule(doc, M, y, W, 0.6, FAINT) + 7;
      T("স্টাইল / ডিজাইন", M, y, { width: W, size: 8.5, color: GRAY, lineBreak: false });
      y += 13;
      if (!styleEntries.length) {
        y = T("—", M, y, { width: W, size: 10, color: GRAY }) + 2;
      } else {
        let cx = M;
        for (const entry of styleEntries) {
          const label = `${entry.label}: ${entry.value}`;
          const w = printWidth(doc, fonts, label, 9.5) + 14;
          if (cx + w > M + W) {
            cx = M;
            y += 20;
          }
          doc.roundedRect(cx, y, w, 15.5, 3).strokeColor(HAIR).lineWidth(0.6).stroke();
          T(label, cx, y + 3, { width: w, size: 9.5, color: DARK, align: "center", lineBreak: false });
          cx += w + 6;
        }
        y += 20;
      }
      if (s.changeNote || s.notes) {
        const note = [
          s.changeNote ? `সংশোধন: ${s.changeNote}` : null,
          s.notes ? `নোট: ${s.notes}` : null,
        ]
          .filter(Boolean)
          .join("  ");
        y = T(note, M, y + 2, { width: W, size: 9.5, color: DARK, lineGap: 1.4 }) + 2;
      }

      // ── recent orders ──
      y = drawRule(doc, M, y + 2, W, 0.6, FAINT) + 7;
      T("সাম্প্রতিক অর্ডার", M, y, { width: W, size: 8.5, color: GRAY, lineBreak: false });
      y += 13;
      if (!recentOrders.length) {
        y = T("—", M, y, { width: W, size: 10, color: GRAY }) + 2;
      }
      for (const { o } of recentOrders) {
        T(o.orderNo, M, y, { width: 90, size: 9.5, color: INK, lineBreak: false });
        T(toBnDigits(dateShort(o.orderDate)), M + 96, y, { width: 90, size: 9.5, color: DARK, lineBreak: false });
        T(statusMeta(o.status).labelBn, M + 190, y, { width: 100, size: 9.5, color: DARK, lineBreak: false });
        T(toBnDigits(`৳${Number(o.total).toLocaleString("en-US")}`), M, y, { width: W, size: 9.5, color: INK, align: "right", lineBreak: false });
        y += 14.5;
      }

      // ── barcode + signature ──
      y = drawRule(doc, M, y + 3, W, 1.2, INK) + 8;
      doc.image(barcode, M, y, { width: 170, height: 34 });
      T(toBnDigits(formatRecordCode(custCode)), M, y + 37, { width: 170, size: 9.5, color: INK, align: "center", lineBreak: false });
      T("বারকোড স্ক্যান করে রেকর্ড খুলুন", M, y + 49, { width: 170, size: 8, color: GRAY, align: "center", lineBreak: false });
      const sigX = M + W - 170;
      drawRule(doc, sigX, y + 30, 170, 0.7, INK);
      T(`মাস্টারের স্বাক্ষর · তারিখ: ${toBnDigits(dateBn(s.measuredAt))}`, sigX, y + 34, {
        width: 170,
        size: 9,
        color: DARK,
        align: "right",
        lineBreak: false,
      });
      y += 60;
      return T("এই কার্ডের মাপ অপরিবর্তনীয় — সংশোধন হলে নতুন ভার্সন তৈরি হয়।", M, y, { width: W, size: 8, color: GRAY });
    },
  });

  return { buffer, fileName: `measurement-card-${c.name.replace(/\s+/g, "-")}.pdf` };
}
