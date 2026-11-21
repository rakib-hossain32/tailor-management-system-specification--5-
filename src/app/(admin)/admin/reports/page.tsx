import { requireAdminPage } from "@/lib/page-auth";
import { asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, expenses, garmentTypes, orderItems, orders, payments, tasks, workers, fabrics } from "@/db/schema";
import Link from "next/link";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isoDate, startOfToday, taka } from "@/lib/format";

export const dynamic = "force-dynamic";

function Bar({ label, value, max, suffix = "" }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <li className="py-2">
      <div className="flex justify-between text-[14.5px]">
        <span>{label}</span>
        <span className="num font-medium">
          {value.toLocaleString("en-US")}
          {suffix}
        </span>
      </div>
      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAdminPage(true);
  const sp = await searchParams;
  const days = sp.range === "7" ? 7 : sp.range === "90" ? 90 : 30;
  const from = new Date(startOfToday().getTime() - (days - 1) * 86_400_000);
  const fromISO = isoDate(from);

  const [salesRows, payRows, expRows, wageRows, custRows, garmentRows, itemRows, fabricRows] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(${orders.total}),0)`, n: sql<number>`count(*)::int` })
      .from(orders)
      .where(gte(orders.orderDate, fromISO)),
    db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .where(gte(payments.receivedAt, from)),
    db.select({ category: expenses.category, total: sql<string>`coalesce(sum(${expenses.amount}),0)` }).from(expenses).where(gte(expenses.date, fromISO)).groupBy(expenses.category),
    db
      .select({
        name: workers.name,
        earned: sql<string>`coalesce(sum(${tasks.pieceRate}) filter (where ${tasks.status} = 'qc_passed'),0)`,
        done: sql<number>`count(*) filter (where ${tasks.status} = 'qc_passed')::int`,
      })
      .from(tasks)
      .innerJoin(workers, eq(tasks.workerId, workers.id))
      .where(gte(tasks.completedAt, from))
      .groupBy(workers.name)
      .orderBy(desc(sql`1`)),
    db
      .select({ name: customers.name, spent: sql<string>`coalesce(sum(${orders.total}),0)`, n: sql<number>`count(*)::int` })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(gte(orders.orderDate, fromISO))
      .groupBy(customers.name)
      .orderBy(desc(sql`2`))
      .limit(8),
    db.select({ name: garmentTypes.nameBn, n: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}),0)` }).from(orderItems).innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id)).groupBy(garmentTypes.nameBn).orderBy(desc(sql`2`)),
    db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    db.select({ value: sql<string>`coalesce(sum(${fabrics.stockQty} * ${fabrics.costPrice}),0)`, low: sql<number>`count(*) filter (where ${fabrics.stockQty} <= ${fabrics.reorderLevel})::int` }).from(fabrics),
  ]);

  const totalSales = Number(salesRows[0]?.total ?? 0);
  const totalIncome = Number(payRows[0]?.total ?? 0);
  const totalExpense = expRows.reduce((s, r) => s + Number(r.total), 0);
  const wages = wageRows.reduce((s, r) => s + Number(r.earned), 0);
  const grossProfit = totalIncome - totalExpense - wages;
  const maxGarment = Math.max(1, ...garmentRows.map((g) => Number(g.total)));
  const maxCust = Math.max(1, ...custRows.map((c) => Number(c.spent)));
  const maxWage = Math.max(1, ...wageRows.map((w) => Number(w.earned)));
  const maxExpense = Math.max(1, ...expRows.map((e) => Number(e.total)));

  const kpis = [
    { l: `অর্ডার মূল্য (${days} দিন)`, v: taka(totalSales), sub: `${salesRows[0]?.n ?? 0}টি অর্ডার` },
    { l: "আসা টাকা", v: taka(totalIncome), sub: "সব পেমেন্ট" },
    { l: "খরচ + মজুরি", v: taka(totalExpense + wages), sub: `খরচ ${taka(totalExpense)} · মজুরি ${taka(wages)}` },
    { l: "নিট (আনুমানিক)", v: taka(grossProfit), sub: "আয় − খরচ − মজুরি", alert: grossProfit < 0 },
  ];

  const statusCounts = Object.fromEntries(itemRows.map((r) => [r.status, r.n]));

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="রিপোর্ট"
        title="বিক্রয়, লাভ-ক্ষতি ও কারিগর"
        sub="সব হিসাব সরাসরি ডাটাবেস থেকে — CSV/PDF এক্সপোর্ট পরবর্তী ফেজে যুক্ত হবে।"
        actions={
          <Tabs value={String(days)}>
            <TabsList>
              {[
                ["7", "৭ দিন"],
                ["30", "৩০ দিন"],
                ["90", "৯০ দিন"],
              ].map(([v, l]) => (
                <TabsTrigger key={v} value={v} asChild>
                  <Link href={`/admin/reports?range=${v}`}>{l}</Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <section className="paper-card overflow-hidden">
        <div className="ticks-h h-3 bg-gold/30" />
        <div className="grid grid-cols-2 divide-ink/10 lg:grid-cols-4 lg:divide-x">
          {kpis.map((k) => (
            <div key={k.l} className="border-b border-ink/10 px-5 py-4 lg:border-b-0">
              <div className="smallcaps text-stone">{k.l}</div>
              <div className={`num mt-1.5 text-[25px] leading-none font-semibold ${k.alert ? "text-chalk" : ""}`}>
                {k.v}
              </div>
              <div className="mt-1.5 text-[13px] text-ink-3">{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="paper-card p-5">
          <h2 className="text-xl">পোশাক অনুযায়ী বিক্রয়</h2>
          <ul className="mt-3">
            {garmentRows.map((g) => (
              <Bar key={g.name} label={`${g.name} (${g.n})`} value={Number(g.total)} max={maxGarment} suffix="৳" />
            ))}
          </ul>
          {garmentRows.length === 0 && <Empty>কোনো ডেটা নেই।</Empty>}
        </section>

        <section className="paper-card p-5">
          <h2 className="text-xl">কারিগরের মজুরি (শুধু QC পাস)</h2>
          <ul className="mt-3">
            {wageRows.map((w) => (
              <Bar key={w.name} label={`${w.name} · ${w.done}টি কাজ`} value={Number(w.earned)} max={maxWage} suffix="৳" />
            ))}
          </ul>
          {wageRows.length === 0 && <Empty>কোনো মজুরি জমা হয়নি।</Empty>}
        </section>

        <section className="paper-card p-5">
          <h2 className="text-xl">খরচ (ক্যাটাগরি)</h2>
          <ul className="mt-3">
            {expRows.map((e) => (
              <Bar key={e.category} label={e.category} value={Number(e.total)} max={maxExpense} suffix="৳" />
            ))}
          </ul>
          {expRows.length === 0 && <Empty>এই সময়ে খরচ নেই।</Empty>}
        </section>

        <section className="paper-card p-5">
          <h2 className="text-xl">শীর্ষ কাস্টমার</h2>
          <ul className="mt-3">
            {custRows.map((c) => (
              <Bar key={c.name} label={`${c.name} · ${c.n} অর্ডার`} value={Number(c.spent)} max={maxCust} suffix="৳" />
            ))}
          </ul>
          {custRows.length === 0 && <Empty>কোনো অর্ডার নেই।</Empty>}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="paper-card p-5">
          <h2 className="text-xl">স্ট্যাটাস অনুযায়ী অর্ডার</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(statusCounts).map(([status, n]) => (
              <span key={status} className="rounded-sm border border-ink/25 px-3 py-1.5 text-[14.5px]">
                {status} <b className="num">{n}</b>
              </span>
            ))}
            {itemRows.length === 0 && <span className="text-stone">কোনো অর্ডার নেই।</span>}
          </div>
        </section>

        <section className="paper-card p-5">
          <h2 className="text-xl">ইনভেন্টরি</h2>
          <dl className="mt-3 space-y-2 text-[15.5px]">
            <div className="flex justify-between border-b border-dashed border-stone/50 pb-1.5">
              <dt className="text-ink-3">স্টকের মোট মূল্য</dt>
              <dd className="num">{taka(fabricRows[0]?.value ?? 0)}</dd>
            </div>
            <div className="flex justify-between border-b border-dashed border-stone/50 pb-1.5">
              <dt className="text-ink-3">লো-স্টক আইটেম</dt>
              <dd className={`num ${Number(fabricRows[0]?.low ?? 0) > 0 ? "text-chalk" : ""}`}>
                {fabricRows[0]?.low ?? 0}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">সক্রিয় অর্ডার</dt>
              <dd className="num">
                {Object.entries(statusCounts)
                  .filter(([s]) => !["delivered", "cancelled"].includes(s))
                  .reduce((s, [, n]) => s + n, 0)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="text-[14px] text-stone">
        নোট: লাভ-ক্ষতি হিসাব “আসা টাকা − খরচ − মজুরি” ভিত্তিক (cash basis)। পূর্ণাঙ্গ অ্যাকাউন্টিং
        (ডবল-এন্ট্রি, VAT) এই ভার্সনের পরিধির বাইরে।
      </p>
    </div>
  );
}
