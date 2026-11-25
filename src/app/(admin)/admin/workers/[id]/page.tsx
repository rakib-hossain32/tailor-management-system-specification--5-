import { viewFields } from "@/server/repositories/views";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { garmentTypes, orderItems, orders, tasks, workers } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { dateShort, taka } from "@/lib/format";
import { isOverdue } from "@/lib/order-status";

export const dynamic = "force-dynamic";

const STAGE_BN: Record<string, string> = {
  cutting: "কাটিং",
  stitching: "সেলাই",
  finishing: "ফিনিশিং",
  buttoning: "বোতাম",
  alteration: "সংশোধন",
};

const STATUS_BN: Record<string, { label: string; fg: string; bg: string }> = {
  assigned: { label: "অ্যাসাইন", fg: "#46546C", bg: "#ECE7DE" },
  in_progress: { label: "চলছে", fg: "#8A4B08", bg: "#FCE4CC" },
  done: { label: "QC বাকি", fg: "#1B4F8F", bg: "#DCE9F8" },
  qc_passed: { label: "পাস", fg: "#1D6B3F", bg: "#D9F0E1" },
  rework: { label: "রিওয়ার্ক", fg: "#8E2C22", bg: "#F8DEDA" },
};

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage(true);
  const { id } = await params;

  const wRows = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (wRows.length === 0) notFound();
  const w = wRows[0];

  const [taskRows, summary] = await Promise.all([
    db
      .select({
        t: viewFields(tasks),
        orderId: orders.id,
        orderNo: orders.orderNo,
        delivery: orders.deliveryDate,
        orderStatus: orders.status,
        garment: garmentTypes.nameBn,
        qty: orderItems.quantity,
      })
      .from(tasks)
      .innerJoin(orderItems, eq(tasks.orderItemId, orderItems.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
      .where(eq(tasks.workerId, id))
      .orderBy(desc(tasks.assignedAt))
      .limit(300),
    db
      .select({
        total: sql<string>`coalesce(sum(${tasks.pieceRate}),0)`,
        earned: sql<string>`coalesce(sum(${tasks.pieceRate}) filter (where ${tasks.status} = 'qc_passed'),0)`,
        passed: sql<number>`count(*) filter (where ${tasks.status} = 'qc_passed')::int`,
        rework: sql<number>`count(*) filter (where ${tasks.status} = 'rework')::int`,
        open: sql<number>`count(*) filter (where ${tasks.status} in ('assigned','in_progress','rework','done'))::int`,
      })
      .from(tasks)
      .where(eq(tasks.workerId, id)),
  ]);

  const s = summary[0];
  const byStage = new Map<string, { n: number; amt: number }>();
  for (const r of taskRows) {
    if (r.t.status !== "qc_passed") continue;
    const rec = byStage.get(r.t.stage) ?? { n: 0, amt: 0 };
    rec.n += 1;
    rec.amt += Number(r.t.pieceRate ?? 0);
    byStage.set(r.t.stage, rec);
  }

  const totalTasks = taskRows.length;
  const rework = taskRows.filter((t) => t.t.status === "rework").length;
  const onTime = taskRows.filter(
    (t) => !isOverdue(t.orderStatus, t.delivery) && ["done", "qc_passed"].includes(t.t.status),
  ).length;
  const completed = taskRows.filter((t) => ["done", "qc_passed"].includes(t.t.status)).length;
  const reworkRate = totalTasks ? Math.round((rework / totalTasks) * 100) : 0;
  const onTimeRate = completed ? Math.round((onTime / completed) * 100) : 100;

  const statTiles = [
    { l: "মোট পিস কাজ", v: String(totalTasks) },
    { l: "সম্পন্ন (QC পাস)", v: String(s.passed) },
    { l: "রিওয়ার্ক হার", v: `${reworkRate}%`, alert: reworkRate > 10 },
    { l: "সময়মতো সম্পন্ন", v: `${onTimeRate}%`, alert: onTimeRate < 80 },
    { l: "জমা মজুরি", v: taka(s.earned) },
    { l: "চলমান কাজ", v: String(s.open), alert: s.open > 3 },
  ];

  return (
    <div className="space-y-5">
      <Link href="/admin/workers" className="chalk-link text-[14.5px] text-gold-dark">
        ← কারিগর তালিকা
      </Link>

      <PageHead
        eyebrow="কারিগর প্রোফাইল"
        title={w.name}
        sub={`${w.role === "cutting" ? "কাটার" : w.role === "stitching" ? "সেলাই কারিগর" : "ফিনিশার"}${
          w.skillTags.length ? ` · ${w.skillTags.join(", ")}` : ""
        }${w.joinedOn ? ` · যোগদান ${dateShort(w.joinedOn)}` : ""}`}
        actions={
          <>
            <span className="rounded-sm border border-ink/25 px-4 py-2.5 text-[15px]">
              খোলা কাজ <b className="num">{s.open}</b>
            </span>
            <span className="rounded-sm bg-ink px-4 py-2.5 text-[15px] text-paper">
              জমা মজুরি <b className="num">৳{Math.round(Number(s.earned)).toLocaleString("en-US")}</b>
            </span>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statTiles.map((k) => (
          <div key={k.l} className="rounded-md border border-ink/12 bg-white p-3.5">
            <div className="smallcaps text-stone">{k.l}</div>
            <div
              className={`num mt-1.5 text-[22px] leading-none font-semibold ${
                k.alert ? "text-chalk" : "text-ink"
              }`}
            >
              {k.v}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="paper-card overflow-hidden">
          <div className="border-b border-ink/15 px-5 py-3.5">
            <h2 className="text-xl">কাজের ইতিহাস ({taskRows.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[720px] text-[14.5px]">
              <TableHeader>
                <TableRow className="border-b border-ink/25 text-left">
                  {["অর্ডার", "পোশাক", "ধাপ", "পরিমাণ", "ডেলিভারি", "স্ট্যাটাস", "রেট"].map((h) => (
                    <TableHead key={h} className="smallcaps px-4 py-2.5 font-medium text-stone">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Empty>এখনো কোনো কাজ পাওয়া যায়নি।</Empty>
                    </TableCell>
                  </TableRow>
                )}
                {taskRows.map(({ t, orderId, orderNo, delivery, orderStatus, garment, qty }) => {
                  const st = STATUS_BN[t.status] ?? STATUS_BN.assigned;
                  const late = isOverdue(orderStatus, delivery);
                  return (
                    <TableRow key={t.id} className="ledger-row">
                      <TableCell className="code px-4 py-3">
                        <Link href={`/admin/orders/${orderId}`} className="chalk-link">
                          {orderNo.slice(-7)}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {garment} <span className="num text-stone">×{qty}</span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-ink-3">{STAGE_BN[t.stage]}</TableCell>
                      <TableCell className="px-4 py-3 text-ink-3">
                        {t.completedAt ? dateShort(t.completedAt) : "—"}
                      </TableCell>
                      <TableCell className={`num px-4 py-3 ${late ? "text-chalk" : "text-ink-3"}`}>
                        {dateShort(delivery)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[13px]"
                          style={{ color: st.fg, backgroundColor: st.bg }}
                        >
                          {st.label}
                        </span>
                      </TableCell>
                      <TableCell className="num px-4 py-3">৳{Number(t.pieceRate ?? 0)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="space-y-5">
          <section className="paper-card p-5">
            <h2 className="text-xl">সারসংক্ষেপ</h2>
            <dl className="mt-3 space-y-2 text-[15.5px]">
              {[
                ["মোট কাজ", String(taskRows.length)],
                ["যাচাই পাস", String(s.passed)],
                ["রিওয়ার্ক", String(s.rework)],
                ["চলমান", String(s.open)],
                ["পূর্ণ রেট যোগ", taka(s.total)],
                ["জমা মজুরি", taka(s.earned)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-dashed border-stone/50 pb-1.5">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="num font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13.5px] text-stone">
              মজুরি = শুধু “QC পাস” হওয়া কাজের পিস-রেট। যাচাই বাকি ও রিওয়ার্কের মজুরি পাসের পরে জমা হয়। অ্যাডভান্স/কর্তন লেজার পরবর্তী ফেজে।
            </p>
          </section>

          <section className="paper-card p-5">
            <h2 className="text-xl">ধাপ অনুযায়ী জমা মজুরি (QC পাস)</h2>
            <ul className="mt-3 space-y-2 text-[15px]">
              {[...byStage.entries()].map(([stage, rec]) => (
                <li key={stage} className="flex justify-between border-b border-dashed border-stone/50 pb-1.5">
                  <span>
                    {STAGE_BN[stage]} <span className="num text-stone">×{rec.n}</span>
                  </span>
                  <span className="num">৳{rec.amt.toLocaleString("en-US")}</span>
                </li>
              ))}
              {byStage.size === 0 && <li className="text-stone">কোনো ডেটা নেই।</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
