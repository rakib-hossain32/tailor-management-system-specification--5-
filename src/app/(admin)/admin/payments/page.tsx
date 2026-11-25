import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, expenses, orders, payments } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { DueBadge, StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateShort, isoDate, startOfToday, taka } from "@/lib/format";
import { isOverdue } from "@/lib/order-status";

export const dynamic = "force-dynamic";

const METHOD_BN: Record<string, string> = {
  cash: "ক্যাশ",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  card: "কার্ড",
  bank: "ব্যাংক",
};

export default async function PaymentsPage() {
  await requireAdminPage();
  const today = startOfToday();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dueRows, payRows, expRows, todayIncome, monthIncome] = await Promise.all([
    db
      .select({ o: viewFields(orders), c: viewFields(customers) })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(sql`${orders.status} not in ('delivered','cancelled') AND ${orders.dueAmount} > 0`)
      .orderBy(orders.deliveryDate),
    db
      .select({ p: viewFields(payments), customer: customers.name, orderNo: orders.orderNo })
      .from(payments)
      .leftJoin(orders, eq(payments.orderId, orders.id))
      .innerJoin(customers, eq(payments.customerId, customers.id))
      .orderBy(desc(payments.receivedAt))
      .limit(30),
    db.select().from(expenses).orderBy(desc(expenses.date)).limit(30),
    db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .where(gte(payments.receivedAt, today)),
    db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .where(gte(payments.receivedAt, monthStart)),
  ]);

  const totalDue = dueRows.reduce((s, r) => s + Number(r.o.dueAmount), 0);
  const todayExpenses = expRows
    .filter((e) => e.date === isoDate(today))
    .reduce((s, e) => s + Number(e.amount), 0);
  const monthExpenses = expRows
    .filter((e) => e.date >= isoDate(monthStart))
    .reduce((s, e) => s + Number(e.amount), 0);

  const income = Number(todayIncome[0]?.total ?? 0);
  const monthIncomeTotal = Number(monthIncome[0]?.total ?? 0);

  const kpis = [
    { l: "আজকের আয়", v: taka(income), sub: `আজকের খরচ ${taka(todayExpenses)}` },
    { l: "এ মাসের আয়", v: taka(monthIncomeTotal), sub: `এ মাসের খরচ ${taka(monthExpenses)}` },
    { l: "মোট বকেয়া", v: taka(totalDue), sub: `${dueRows.length}টি অর্ডার`, alert: totalDue > 0 },
    { l: "এ মাসের নিট", v: taka(monthIncomeTotal - monthExpenses), sub: "আয় − খরচ" },
  ];

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow="আর্থিক হিসাব"
        title="পেমেন্ট, বকেয়া ও ক্যাশবুক"
        actions={
          <Badge variant="secondary" className="h-10 px-4 text-[15px]">
            আজকের আয় <b className="num ml-1.5">{taka(income)}</b>
          </Badge>
        }
      />

      <Card>
        <div className="ticks-h h-3 bg-gold/30" />
        <CardContent className="grid grid-cols-2 divide-ink/10 pt-5 lg:grid-cols-4 lg:divide-x">
          {kpis.map((k) => (
            <div key={k.l} className="border-b border-ink/10 px-5 py-4 lg:border-b-0">
              <div className="smallcaps text-stone">{k.l}</div>
              <div className={`num mt-1.5 text-[25px] leading-none font-semibold ${k.alert ? "text-chalk" : ""}`}>
                {k.v}
              </div>
              <div className="mt-1.5 text-[13px] text-ink-3">{k.sub}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>বকেয়া তালিকা</CardTitle>
            <CardDescription>ডেলিভারির তারিখ অনুযায়ী সাজানো — লাল দেরি চিহ্নিত</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>কাস্টমার</TableHead>
                  <TableHead>অর্ডার নং</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead>ডেলিভারি</TableHead>
                  <TableHead className="text-right">মোট</TableHead>
                  <TableHead className="text-right">পরিশোধিত</TableHead>
                  <TableHead className="text-right">বকেয়া</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dueRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-ink-3">
                      কোনো বকেয়া নেই — দারুণ! ✓
                    </TableCell>
                  </TableRow>
                )}
                {dueRows.map(({ o, c }) => {
                  const late = isOverdue(o.status, o.deliveryDate);
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/admin/customers/${c.id}`} className="chalk-link">
                          {c.name}
                        </Link>
                        <span className="num block text-[12.5px] text-stone">{c.phone.replace("+88", "")}</span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/orders/${o.id}`} className="chalk-link num">
                          {o.orderNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className={`num ${late ? "text-chalk" : ""}`}>{dateShort(o.deliveryDate)}</TableCell>
                      <TableCell className="num text-right">{Number(o.total).toLocaleString("en-US")}</TableCell>
                      <TableCell className="num text-right text-ink-3">
                        {Number(o.paidAmount).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DueBadge due={o.dueAmount} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="text-right">
                    মোট বকেয়া
                  </TableCell>
                  <TableCell className="num text-right">{taka(totalDue)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>সাম্প্রতিক পেমেন্ট</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-ink/10">
                {payRows.length === 0 && <Empty>কোনো পেমেন্ট নেই।</Empty>}
                {payRows.map(({ p, customer, orderNo }) => (
                  <li key={p.id} className="px-1 py-3 text-[14.5px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="num font-medium">{taka(p.amount)}</span>
                      <span className="num text-[12.5px] text-stone">
                        {new Date(p.receivedAt).toLocaleString("en-GB", {
                          timeZone: "Asia/Dhaka",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] text-ink-3">
                      <span>{customer}</span>
                      {orderNo && <span className="num">{orderNo}</span>}
                      <span>{METHOD_BN[p.method] ?? p.method}</span>
                      <span className="num">{p.receiptNo}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>খরচ</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-ink/10">
                {expRows.slice(0, 12).map((e) => (
                  <li key={e.id} className="flex items-baseline gap-3 py-2.5 text-[14.5px]">
                    <span className="num w-20 shrink-0 text-[13px] text-stone">{dateShort(e.date)}</span>
                    <span className="flex-1">
                      {e.category}
                      {e.note && <span className="block text-[12.5px] text-stone">{e.note}</span>}
                    </span>
                    <span className="num text-chalk">− ৳{Number(e.amount).toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ul>
              <Link href="/admin/expenses" className="chalk-link mt-3 inline-block text-[14.5px] text-gold-dark">
                সব খরচ দেখুন →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
