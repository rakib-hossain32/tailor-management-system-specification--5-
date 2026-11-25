import { viewFields } from "@/server/repositories/views";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks, workers } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { PrintButton } from "@/components/PrintButton";
import { taka } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  await requireAdminPage(true);
  // Aggregate tasks per worker in a subquery first: selecting every
  // worker_details column while grouping only by its id is rejected by
  // Postgres (a view has no primary key for functional dependency).
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
  const rawRows = await db
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
    .orderBy(asc(workers.name));
  const rows = rawRows.map((r) => ({
    ...r,
    total: r.total ?? "0",
    earned: r.earned ?? "0",
    pending: r.pending ?? "0",
    passed: r.passed ?? 0,
    rework: r.rework ?? 0,
    open: r.open ?? 0,
  }));

  const grandEarned = rows.reduce((s, r) => s + Number(r.earned), 0);
  const grandPending = rows.reduce((s, r) => s + Number(r.pending), 0);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="পেরোল"
        title="কারিগরের মজুরি হিসাব"
        sub="পিস-রেট অনুযায়ী জমা মজুরি — QC পাস হলেই যোগ হয়। প্রিন্ট করে স্বাক্ষরসহ সংরক্ষণ করা যায়।"
        actions={
          <span className="no-print flex flex-wrap gap-2.5">
            <PrintButton label="পেরোল শিট প্রিন্ট / PDF" />
            <Link href="/admin/workers" className="rounded-sm border border-ink/30 px-4 py-2.5 text-[15px] hover:bg-ink/5">
              কারিগর তালিকা
            </Link>
          </span>
        }
      />

      <div className="grid gap-5 sm:grid-cols-3">
        {[
          ["জমা মজুরি (QC পাস)", taka(grandEarned), false],
          ["চলমান কাজের সম্ভাব্য", taka(grandPending), false],
          ["মোট দায়", taka(grandEarned + grandPending), true],
        ].map(([l, v]) => (
          <div key={l as string} className="paper-card p-5">
            <div className="smallcaps text-stone">{l as string}</div>
            <div className="num mt-1.5 text-[26px] font-semibold">{v as string}</div>
          </div>
        ))}
      </div>

      <section className="print-area paper-card overflow-hidden print-page">
        <div className="border-b border-ink/15 px-5 py-3.5">
          <h2 className="text-xl">পেরোল শিট</h2>
          <p className="text-[13.5px] text-stone">
            তারিখ: {new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })} · রহমান টেইলার্স
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[760px] text-[15px]">
            <TableHeader>
              <TableRow className="border-b border-ink text-left">
                {["কারিগর", "ধারা", "পাস", "রিওয়ার্ক", "চলমান", "জমা মজুরি", "চলমান মূল্য", "স্বাক্ষর"].map((h) => (
                  <TableHead key={h} className="smallcaps px-4 py-3 font-medium text-stone">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Empty>কোনো কারিগর নেই।</Empty>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.w.id} className="ledger-row">
                  <TableCell className="px-4 py-3.5">
                    <Link href={`/admin/workers/${r.w.id}`} className="chalk-link font-medium">
                      {r.w.name}
                    </Link>
                    <span className="block text-[13px] text-stone">
                      {r.w.role === "cutting" ? "কাটার" : r.w.role === "stitching" ? "সেলাই" : "ফিনিশার"}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-ink-3">{r.w.payType === "piece_rate" ? "পিস-রেট" : "বেতন"}</TableCell>
                  <TableCell className="num px-4 py-3.5">{r.passed}</TableCell>
                  <TableCell className={`num px-4 py-3.5 ${r.rework ? "text-chalk" : "text-ink-3"}`}>{r.rework}</TableCell>
                  <TableCell className="num px-4 py-3.5 text-ink-3">{r.open}</TableCell>
                  <TableCell className="num px-4 py-3.5 font-semibold">{taka(r.earned)}</TableCell>
                  <TableCell className="num px-4 py-3.5 text-ink-3">{taka(r.pending)}</TableCell>
                  <TableCell className="px-4 py-3.5">
                    <span className="block h-8 w-24 border-b border-dashed border-stone" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="border-t-2 border-ink">
                <TableCell colSpan={5} className="px-4 py-3 text-right font-medium">
                  সর্বমোট
                </TableCell>
                <TableCell className="num px-4 py-3 text-[17px] font-semibold">{taka(grandEarned)}</TableCell>
                <TableCell className="num px-4 py-3 text-[17px]">{taka(grandPending)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      <p className="text-[14px] text-stone">
        মাসিক বেতনভোগী কর্মী ও হাজিরা এই ভার্সনে নেই — পিস-রেট কারিগরদের জন্য প্রযোজ্য।
      </p>
    </div>
  );
}
