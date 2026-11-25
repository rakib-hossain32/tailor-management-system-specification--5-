import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { DueBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminPage();
  const { q = "" } = await searchParams;

  const rows = await db
    .select({
      c: viewFields(customers),
      orderCount: sql<number>`(select count(*)::int from orders where customer_id = ${customers.id})`,
    })
    .from(customers)
    .where(
      q
        ? or(
            ilike(customers.name, `%${q}%`),
            ilike(customers.phone, `%${q}%`),
            ilike(customers.address, `%${q}%`),
          )
        : undefined,
    )
    .orderBy(desc(customers.createdAt))
    .limit(200);

  const dueRows = await db
    .select({ customerId: customers.id, due: sql<string>`coalesce(sum(${orders.dueAmount}),0)` })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(sql`${orders.status} not in ('delivered','cancelled')`)
    .groupBy(customers.id);
  const dueByCustomer = new Map(dueRows.map((d) => [d.customerId, Number(d.due)]));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="smallcaps text-stone">কাস্টমার ব্যবস্থাপনা</div>
          <h1 className="mt-1 text-3xl sm:text-4xl">কাস্টমার খাতা</h1>
          <p className="mt-1 text-[15px] text-ink-3">মোট {rows.length} জন — ফোন নম্বর দিয়ে দ্রুত খুঁজুন</p>
        </div>
        <Button asChild size="lg">
          <Link href="/admin/customers/new">+ নতুন কাস্টমার</Link>
        </Button>
      </header>

      <Card>
        <CardContent className="pt-5">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label htmlFor="cu-q">খোঁজ</Label>
              <Input id="cu-q" name="q" defaultValue={q} placeholder="নাম, ফোন বা ঠিকানা…" />
            </div>
            <Button type="submit">খুঁজুন</Button>
            <Button asChild type="button" variant="outline">
              <Link href="/admin/customers">রিসেট</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>নাম</TableHead>
                <TableHead>ফোন</TableHead>
                <TableHead>ঠিকানা</TableHead>
                <TableHead>ট্যাগ</TableHead>
                <TableHead className="text-right">অর্ডার</TableHead>
                <TableHead className="text-right">বকেয়া</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-ink-3">
                    কোনো কাস্টমার পাওয়া যায়নি।
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ c, orderCount }) => {
                const due = dueByCustomer.get(c.id) ?? 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/admin/customers/${c.id}`} className="chalk-link font-medium">
                        {c.name}
                      </Link>
                      {c.gender === "female" && (
                        <Badge variant="gold" className="ml-2">
                          লেডিস
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="num text-ink-3">{formatPhone(c.phone)}</TableCell>
                    <TableCell className="text-ink-3">{c.address ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {c.tags.map((t) => (
                          <Badge key={t} variant="gold">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="num text-right">{orderCount}</TableCell>
                    <TableCell className="text-right">
                      {due > 0 ? <DueBadge due={due} /> : <span className="text-stone">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
