import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import * as bwipjs from "bwip-js/node";
import { db } from "@/db";
import {
  customers,
  garmentTypes,
  measurementProfiles,
  measurementSets,
  orderItems,
  orders,
  payments,
  settings,
} from "@/db/schema";
import { viewFields } from "@/server/repositories/views";
import { getPinnedMeasurementSchemas } from "@/server/repositories/measurement-schema";
import { dateBn, dateShort, taka } from "@/lib/format";
import { formatMeasurement, toBnDigits } from "@/lib/units";
import { statusMeta } from "@/lib/order-status";
import { flattenFields, type MeasurementSchema } from "@/lib/measurements";
import { recordCode, formatRecordCode } from "@/lib/barcode";
import {
  DARK,
  FAINT,
  GRAY,
  HAIR,
  INK,
  drawPrintText,
  drawRule,
  printHeight,
  renderDynamicPdf,
} from "./receipt";

/**
 * Cash memo / invoice PDF — generated on the server with PDFKit,
 * like every TailorPro document (see ./receipt for the shared print
 * rules: Tiro Bangla on paper, black on white only, exactly one
 * page — the A5-width sheet grows taller with more items instead of
 * spilling onto a second page; all text via drawPrintText).
 *
 * This replaces the old browser-print invoice page: what the owner
 * downloads is a real, fixed PDF file — not a Ctrl+P capture whose
 * layout depended on the browser. The barcode at the foot is the
 * customer's real record code (lib/barcode): staff scan it with the
 * in-app scanner and the customer hub opens — no URL on paper.
 */

const PAGE_W = 419.5; // A5 width
const MIN_H = 595.3; // A5 length

const METHOD_BN: Record<string, string> = {
  cash: "ক্যাশ",
  bkash: "বিকাশ",
  nagad: "নগদ",
  rocket: "রকেট",
  card: "কার্ড",
  bank: "ব্যাংক",
};

export async function buildInvoicePdf(
  id: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  if (!/^[a-f\d-]{36}$/i.test(id)) return null;
  const head = await db
    .select({ o: viewFields(orders), c: viewFields(customers) })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (!head.length) return null;
  const { o, c } = head[0];

  const [items, pays, shopRows, profiles] = await Promise.all([
    db
      .select({ oi: orderItems, g: viewFields(garmentTypes) })
      .from(orderItems)
      .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
      .where(eq(orderItems.orderId, id)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.receivedAt)),
    db.select().from(settings).where(eq(settings.key, "shop")).limit(1),
    db.select().from(measurementProfiles).where(eq(measurementProfiles.customerId, c.id)),
  ]);
  const shop = (shopRows[0]?.value ?? {}) as Record<string, string>;
  const setIds = items.map((i) => i.oi.measurementSetId).filter(Boolean) as string[];
  const sets = setIds.length
    ? await db.select().from(measurementSets).where(inArray(measurementSets.id, setIds))
    : [];
  const schemaById = await getPinnedMeasurementSchemas(sets);
  const setById = new Map(sets.map((s) => [s.id, s]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const custCode = recordCode(c.id);
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: custCode,
    scale: 5,
    height: 9,
    includetext: false,
    backgroundcolor: "FFFFFF",
    barcolor: "000000",
  });

  const shopName = shop.name_bn ?? "রহমান টেইলার্স";
  const typeLabel =
    o.type === "alteration" ? "অল্টারেশন" : o.type === "bulk" ? "গ্রুপ অর্ডার" : "নতুন অর্ডার";

  const buffer = await renderDynamicPdf({
    width: PAGE_W,
    minHeight: MIN_H,
    draw: (doc, fonts) => {
      const M = 26;
      const W = PAGE_W - M * 2;
      const T = (
        text: string,
        x: number,
        yy: number,
        opts: { width: number; size: number; color: string; align?: "left" | "center" | "right"; lineBreak?: boolean; lineGap?: number; ellipsis?: boolean },
      ) => drawPrintText(doc, fonts, text, x, yy, opts);
      let y = 24;

      // ── header: shop block left, memo block right (explicit ys) ──
      const y0 = y;
      const nameBottom = T(shopName, M, y0, { width: W - 140, size: 20, color: INK });
      let leftBottom = nameBottom + 1;
      const shopMeta = [
        shop.address,
        shop.phone ? `ফোন: ${toBnDigits(shop.phone.replace("+88", ""))}` : null,
        shop.hours,
      ]
        .filter(Boolean)
        .join(" · ");
      if (shopMeta) {
        leftBottom = T(shopMeta, M, leftBottom, { width: W - 140, size: 9.5, color: DARK });
      }
      T("ক্যাশ মেমো / ইনভয়েস", M, y0, { width: W, size: 8.5, color: GRAY, align: "right", lineBreak: false });
      T(o.orderNo, M, y0 + 11, { width: W, size: 15, color: INK, align: "right", lineBreak: false });
      T(`তারিখ: ${toBnDigits(dateShort(o.orderDate))}`, M, y0 + 31, { width: W, size: 9.5, color: DARK, align: "right", lineBreak: false });
      T(`ডেলিভারি: ${toBnDigits(dateShort(o.deliveryDate))}`, M, y0 + 45, { width: W, size: 9.5, color: DARK, align: "right", lineBreak: false });
      T(`স্ট্যাটাস: ${statusMeta(o.status).labelBn}`, M, y0 + 59, { width: W, size: 9.5, color: DARK, align: "right", lineBreak: false });
      y = Math.max(leftBottom, y0 + 73) + 5;
      y = drawRule(doc, M, y, W, 1.6, INK) + 8;

      // ── customer (left) / order type (right) ──
      const colW = W / 2 - 8;
      const rightX = M + W / 2 + 8;
      T("কাস্টমার", M, y, { width: colW, size: 8, color: GRAY, lineBreak: false });
      T("অর্ডারের ধরন", rightX, y, { width: colW, size: 8, color: GRAY, align: "right", lineBreak: false });
      y += 11;
      const nameB = T(c.name, M, y, { width: colW, size: 13, color: INK });
      T(typeLabel + (o.priority === "urgent" ? " · জরুরি" : ""), rightX, y + 1, {
        width: colW,
        size: 11,
        color: INK,
        align: "right",
        lineBreak: false,
      });
      let ly = nameB + 1;
      let ry = y + 15;
      T(toBnDigits(c.phone.replace("+88", "")), M, ly, { width: colW, size: 10, color: DARK, lineBreak: false });
      T(
        o.source === "walk_in" ? "উৎস: দোকানে সরাসরি" : o.source === "online" ? "উৎস: ওয়েবসাইট" : `উৎস: ${o.source}`,
        rightX,
        ry,
        { width: colW, size: 10, color: DARK, align: "right", lineBreak: false },
      );
      ly += 13;
      if (c.address) {
        ly = T(c.address, M, ly, { width: colW, size: 9.5, color: DARK, lineGap: 1.3 });
      }
      if (o.trialDate) {
        T(`ট্রায়াল: ${toBnDigits(dateShort(o.trialDate))}`, rightX, ry + 13, { width: colW, size: 9.5, color: DARK, align: "right", lineBreak: false });
        ry += 25;
      }
      y = Math.max(ly, ry) + 6;
      y = drawRule(doc, M, y, W, 0.6, FAINT) + 7;

      // ── items table ──
      const cols = {
        idx: { x: M, w: 14 },
        garment: { x: M + 14, w: 82 },
        brief: { x: M + 96, w: 108 },
        fabric: { x: M + 204, w: 46 },
        qty: { x: M + 250, w: 26 },
        unit: { x: M + 276, w: 44 },
        total: { x: M + 320, w: W - 320 },
      };
      const heads: [keyof typeof cols, string, "left" | "right"][] = [
        ["idx", "#", "left"],
        ["garment", "পোশাক", "left"],
        ["brief", "মাপ (সংক্ষেপ)", "left"],
        ["fabric", "কাপড়", "left"],
        ["qty", "পরিমাণ", "right"],
        ["unit", "একক মূল্য", "right"],
        ["total", "মোট", "right"],
      ];
      for (const [key, label, align] of heads) {
        T(label, cols[key].x, y, { width: cols[key].w, size: 8, color: GRAY, align, lineBreak: false });
      }
      y += 11;
      y = drawRule(doc, M, y, W, 0.8, INK) + 5;

      items.forEach(({ oi, g }, idx) => {
        const set = oi.measurementSetId ? setById.get(oi.measurementSetId) : undefined;
        const schema = (set
          ? schemaById.get(set.garmentSchemaVersionId)?.measurementSchema
          : g.measurementSchema) as unknown as MeasurementSchema;
        const brief = set
          ? flattenFields(schema)
              .slice(0, 5)
              .map(
                (f) =>
                  `${f.label_bn} ${toBnDigits(formatMeasurement((set.values as Record<string, number>)?.[f.key], "inch"))}`,
              )
              .join(", ")
          : "—";
        const profile = oi.profileId ? profileById.get(oi.profileId) : undefined;

        const briefH = printHeight(doc, fonts, brief, 8.5, cols.brief.w, 1.2);
        const rowH = Math.max(briefH, set || profile ? 25 : 13) + 7;

        T(toBnDigits(String(idx + 1)), cols.idx.x, y, { width: cols.idx.w, size: 10, color: DARK, lineBreak: false });
        T(g.nameBn, cols.garment.x, y, { width: cols.garment.w, size: 10.5, color: INK });
        if (profile || set) {
          T(
            [profile ? `মাপ: ${profile.displayName}` : null, set ? `সংস্করণ ${toBnDigits("v" + set.version)}` : null]
              .filter(Boolean)
              .join(" · "),
            cols.garment.x,
            y + 13,
            { width: cols.garment.w, size: 8, color: GRAY, lineBreak: false, ellipsis: true },
          );
        }
        T(brief, cols.brief.x, y, { width: cols.brief.w, size: 8.5, color: DARK, lineGap: 1.2 });
        T(
          (oi.fabricSource === "customer" ? "কাস্টমারের" : "দোকানের") +
            (Number(oi.fabricQty) > 0 ? ` · ${toBnDigits(Number(oi.fabricQty))} গজ` : ""),
          cols.fabric.x,
          y,
          { width: cols.fabric.w, size: 8.5, color: DARK },
        );
        T(toBnDigits(String(oi.quantity)), cols.qty.x, y, { width: cols.qty.w, size: 10, color: INK, align: "right", lineBreak: false });
        T(toBnDigits(Number(oi.unitPrice).toLocaleString("en-US")), cols.unit.x, y, { width: cols.unit.w, size: 10, color: INK, align: "right", lineBreak: false });
        T(toBnDigits((oi.quantity * Number(oi.unitPrice)).toLocaleString("en-US")), cols.total.x, y, { width: cols.total.w, size: 10, color: INK, align: "right", lineBreak: false });

        y += rowH;
        y = drawRule(doc, M, y, W, 0.4, FAINT) + 5;
      });
      y += 2;

      // ── payments (left) + totals (right) ──
      const totalsX = M + W - 158;
      const totalsW = 158;
      let ty = y;
      T("পেমেন্ট", M, ty, { width: 190, size: 8, color: GRAY, lineBreak: false });
      ty += 11;
      if (!pays.length) {
        ty = T("কোনো পেমেন্ট নেই।", M, ty, { width: 190, size: 9.5, color: GRAY });
      }
      for (const p of pays) {
        T(`${METHOD_BN[p.method] ?? p.method.toUpperCase()}${p.txnId ? ` · ${p.txnId}` : ""} · ${p.receiptNo}`, M, ty, {
          width: 128,
          size: 9.5,
          color: DARK,
          lineBreak: false,
          ellipsis: true,
        });
        T(toBnDigits(taka(p.amount)), M + 128, ty, { width: 62, size: 9.5, color: INK, align: "right", lineBreak: false });
        ty += 13.5;
      }
      if (shop.invoice_footer) {
        ty = T(shop.invoice_footer, M, ty + 4, { width: 190, size: 8.5, color: GRAY, lineGap: 1.3 });
      }

      let sy = y;
      const totalRow = (label: string, value: string, size: number, strong = false, rule = false) => {
        if (rule) sy = drawRule(doc, totalsX, sy, totalsW, 0.7, HAIR) + 4;
        T(label, totalsX, sy, { width: 78, size, color: strong ? INK : DARK, lineBreak: false });
        T(value, totalsX + 78, sy, { width: 80, size, color: strong ? INK : DARK, align: "right", lineBreak: false });
        sy += size + 5;
      };
      totalRow("উপমোট", toBnDigits(taka(o.subtotal)), 10.5);
      totalRow("ছাড়", `− ${toBnDigits(taka(o.discount))}`, 10.5);
      totalRow("সর্বমোট", toBnDigits(taka(o.total)), 13, true, true);
      totalRow("পরিশোধিত", toBnDigits(taka(o.paidAmount)), 10.5);
      totalRow("বকেয়া", toBnDigits(taka(o.dueAmount)), 14.5, true, true);
      y = Math.max(ty, sy) + 8;

      // ── customer barcode ──
      y = drawRule(doc, M, y, W, 0.6, HAIR) + 7;
      doc.image(barcode, M, y, { width: 150, height: 30 });
      T(toBnDigits(formatRecordCode(custCode)), M + 162, y + 2, { width: 180, size: 9, color: INK, lineBreak: false });
      T("কাস্টমার বারকোড — স্ক্যান করলে কাস্টমারের রেকর্ড খুলবে", M + 162, y + 15, { width: 190, size: 8, color: GRAY });
      y += 38;

      // ── signatures + footer ──
      const sigW = 150;
      drawRule(doc, M, y + 16, sigW, 0.7, INK);
      drawRule(doc, M + W - sigW, y + 16, sigW, 0.7, INK);
      T("কাস্টমারের স্বাক্ষর", M, y + 19, { width: sigW, size: 9, color: DARK, lineBreak: false });
      T("অনুমোদিত স্বাক্ষর", M + W - sigW, y + 19, { width: sigW, size: 9, color: DARK, align: "right", lineBreak: false });
      y += 36;
      y = drawRule(doc, M, y, W, 0.5, FAINT) + 5;
      return T(`ধন্যবাদ — ${shopName} · ${toBnDigits(dateBn(o.orderDate))}`, M, y, { width: W, size: 8.5, color: GRAY, align: "center" });
    },
  });

  return { buffer, fileName: `invoice-${o.orderNo}.pdf` };
}
