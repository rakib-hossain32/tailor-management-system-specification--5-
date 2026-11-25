import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { settings, tasks, workers } from "@/db/schema";
import { viewFields } from "@/server/repositories/views";
import { dateBn, taka } from "@/lib/format";
import { toBnDigits } from "@/lib/units";
import {
  DARK,
  FAINT,
  GRAY,
  HAIR,
  INK,
  drawPrintText,
  drawRule,
  renderDynamicPdf,
} from "./receipt";

/**
 * Payroll sheet PDF — server-generated with PDFKit (see ./receipt
 * for the shared print rules: Tiro Bangla on paper, black on white
 * only, exactly one page that grows with the worker count; all text
 * via drawPrintText). Replaces the old "print this admin page"
 * button: the sheet is a clean document with a signature column,
 * ready to print and file.
 */

const PAGE_W = 595.3; // A4 width
const MIN_H = 420;

export async function buildPayrollPdf(): Promise<{ buffer: Buffer; fileName: string }> {
  // Same aggregation as the payroll page: per-worker totals in a
  // subquery first (a view has no PK for functional dependency).
  const totals = db
    .select({
      workerId: tasks.workerId,
      total: sql<string>`coalesce(sum(${tasks.pieceRate}),0)`.as("total"),
      earned: sql<string>`coalesce(sum(${tasks.pieceRate}) filter (where ${tasks.status} = 'qc_passed'),0)`.as("earned"),
      pending: sql<string>`coalesce(sum(${tasks.pieceRate}) filter (where ${tasks.status} in ('assigned','in_progress','rework','done')),0)`.as("pending"),
      passed: sql<number>`count(*) filter (where ${tasks.status} = 'qc_passed')::int`.as("passed"),
      rework: sql<number>`count(*) filter (where ${tasks.status} = 'rework')::int`.as("rework"),
      open: sql<number>`count(*) filter (where ${tasks.status} in ('assigned','in_progress','rework','done'))::int`.as("open"),
    })
    .from(tasks)
    .groupBy(tasks.workerId)
    .as("task_totals");
  const [rawRows, shopRows] = await Promise.all([
    db
      .select({
        w: viewFields(workers),
        total: totals.total,
        earned: totals.earned,
        pending: totals.pending,
        passed: totals.passed,
        rework: totals.rework,
        open: totals.open,
      })
      .from(workers)
      .leftJoin(totals, eq(totals.workerId, workers.id))
      .where(eq(workers.isActive, true))
      .orderBy(asc(workers.name)),
    db.select().from(settings).where(eq(settings.key, "shop")).limit(1),
  ]);
  const rows = rawRows.map((r) => ({
    ...r,
    earned: Number(r.earned ?? 0),
    pending: Number(r.pending ?? 0),
    passed: r.passed ?? 0,
    rework: r.rework ?? 0,
    open: r.open ?? 0,
  }));
  const shop = (shopRows[0]?.value ?? {}) as Record<string, string>;
  const shopName = shop.name_bn ?? "রহমান টেইলার্স";
  const grandEarned = rows.reduce((s, r) => s + r.earned, 0);
  const grandPending = rows.reduce((s, r) => s + r.pending, 0);
  const today = new Date();

  const buffer = await renderDynamicPdf({
    width: PAGE_W,
    minHeight: MIN_H,
    draw: (doc, fonts) => {
      const M = 30;
      const W = PAGE_W - M * 2;
      const T = (
        text: string,
        x: number,
        yy: number,
        opts: { width: number; size: number; color: string; align?: "left" | "center" | "right"; lineBreak?: boolean; ellipsis?: boolean },
      ) => drawPrintText(doc, fonts, text, x, yy, opts);
      let y = 26;

      T("পেরোল শিট", M, y, { width: W, size: 8.5, color: GRAY, lineBreak: false });
      T(`তারিখ: ${toBnDigits(dateBn(today))}`, M, y, { width: W, size: 8.5, color: GRAY, align: "right", lineBreak: false });
      y += 13;
      y = T(shopName, M, y, { width: W, size: 19, color: INK }) + 1;
      y = T("কারিগরের মজুরি হিসাব — পিস-রেট অনুযায়ী, QC পাস হলেই জমা মজুরিতে যোগ হয়", M, y, { width: W, size: 10, color: DARK }) + 6;
      y = drawRule(doc, M, y, W, 1.6, INK) + 9;

      // summary strip
      const summaries: [string, string][] = [
        ["জমা মজুরি (QC পাস)", toBnDigits(taka(grandEarned))],
        ["চলমান কাজের সম্ভাব্য", toBnDigits(taka(grandPending))],
        ["মোট দায়", toBnDigits(taka(grandEarned + grandPending))],
      ];
      const colW = W / 3;
      summaries.forEach(([label, value], i) => {
        const cx = M + i * colW;
        T(label, cx, y, { width: colW - 10, size: 8.5, color: GRAY, lineBreak: false });
        T(value, cx, y + 12, { width: colW - 10, size: 15, color: INK, lineBreak: false });
      });
      y += 36;
      y = drawRule(doc, M, y, W, 0.6, FAINT) + 8;

      // table
      const cols = {
        name: { x: M, w: 150 },
        passed: { x: M + 150, w: 52 },
        rework: { x: M + 202, w: 60 },
        open: { x: M + 262, w: 58 },
        earned: { x: M + 320, w: 82 },
        pending: { x: M + 402, w: 82 },
        sign: { x: M + 484, w: W - 484 },
      };
      const heads: [keyof typeof cols, string, "left" | "right" | "center"][] = [
        ["name", "কারিগর", "left"],
        ["passed", "পাস", "center"],
        ["rework", "রিওয়ার্ক", "center"],
        ["open", "চলমান", "center"],
        ["earned", "জমা মজুরি", "right"],
        ["pending", "চলমান মূল্য", "right"],
        ["sign", "স্বাক্ষর", "center"],
      ];
      for (const [key, label, align] of heads) {
        T(label, cols[key].x, y, { width: cols[key].w, size: 8.5, color: GRAY, align, lineBreak: false });
      }
      y += 12;
      y = drawRule(doc, M, y, W, 0.8, INK) + 6;

      if (!rows.length) {
        y = T("কোনো কারিগর নেই।", M, y, { width: W, size: 10.5, color: GRAY }) + 4;
      }
      for (const r of rows) {
        T(r.w.name, cols.name.x, y, { width: cols.name.w, size: 11, color: INK, lineBreak: false, ellipsis: true });
        T(toBnDigits(String(r.passed)), cols.passed.x, y, { width: cols.passed.w, size: 10, color: DARK, align: "center", lineBreak: false });
        T(toBnDigits(String(r.rework)), cols.rework.x, y, { width: cols.rework.w, size: 10, color: DARK, align: "center", lineBreak: false });
        T(toBnDigits(String(r.open)), cols.open.x, y, { width: cols.open.w, size: 10, color: DARK, align: "center", lineBreak: false });
        T(toBnDigits(taka(r.earned)), cols.earned.x, y, { width: cols.earned.w, size: 10, color: INK, align: "right", lineBreak: false });
        T(toBnDigits(taka(r.pending)), cols.pending.x, y, { width: cols.pending.w, size: 10, color: DARK, align: "right", lineBreak: false });
        drawRule(doc, cols.sign.x + 4, y + 11, cols.sign.w - 8, 0.5, HAIR);
        y += 19;
        y = drawRule(doc, M, y, W, 0.4, FAINT) + 6;
      }

      // totals row
      T("সর্বমোট", cols.name.x, y, { width: cols.name.w, size: 11.5, color: INK, lineBreak: false });
      T(toBnDigits(taka(grandEarned)), cols.earned.x, y, { width: cols.earned.w, size: 11.5, color: INK, align: "right", lineBreak: false });
      T(toBnDigits(taka(grandPending)), cols.pending.x, y, { width: cols.pending.w, size: 11.5, color: INK, align: "right", lineBreak: false });
      y += 18;
      y = drawRule(doc, M, y, W, 0.8, INK) + 8;
      return T("স্বাক্ষর করে এক কপি কারিগরকে দিন, এক কপি দোকানে সংরক্ষণ করুন।", M, y, { width: W, size: 8.5, color: GRAY });
    },
  });

  return { buffer, fileName: "payroll-sheet.pdf" };
}
