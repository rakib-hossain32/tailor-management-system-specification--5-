import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orderItems, orders, garmentTypes } from "@/db/schema";
import { StatusBadge, DueBadge, UrgentBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/admin/Pagination";
import { QrScanner } from "@/components/QrScanner";
import { PageHead } from "@/components/admin/PageHead";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateShort, daysUntil, relativeDay } from "@/lib/format";
import { isOverdue, ORDER_STATUSES } from "@/lib/order-status";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const TABS = [
  { key: "all", label: "সব" },
  { key: "open", label: "খোলা" },
  { key: "overdue", label: "ওভারডিউ" },
  { key: "ready", label: "রেডি" },
  { key: "delivered", label: "ডেলিভারড" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; tab?: string; page?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = sp.status && sp.status !== "all" ? sp.status : "";
  const q = (sp.q ?? "").trim();
  const tab = sp.tab ?? "all";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const conds = [];
  if (status) conds.push(eq(orders.status, status));
  if (q) {
    conds.push(
      or(
        ilike(orders.orderNo, `%${q}%`),
        ilike(customers.name, `%${q}%`),
        ilike(customers.phone, `%${q}%`),
      )!,
    );
  }

  const rows = await db
    .select({ o: viewFields(orders), c: viewFields(customers) })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(conds.length ? sql.join(conds, sql` AND `) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(500);

  const items = await db
    .select({ oi: orderItems, g: viewFields(garmentTypes) })
    .from(orderItems)
    .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id));
  const byOrder = new Map<string, string[]>();
  for (const it of items) {
    const arr = byOrder.get(it.oi.orderId) ?? [];
    if (!arr.includes(it.g.nameBn)) arr.push(it.g.nameBn);
    byOrder.set(it.oi.orderId, arr);
  }

  const filtered = rows.filter(({ o }) => {
    if (tab === "open") return !["delivered", "cancelled"].includes(o.status);
    if (tab === "overdue") return isOverdue(o.status, o.deliveryDate);
    if (tab === "ready") return o.status === "ready";
    if (tab === "delivered") return o.status === "delivered";
    return true;
  });

  const counts = {
    all: rows.length,
    open: rows.filter(({ o }) => !["delivered", "cancelled"].includes(o.status)).length,
    overdue: rows.filter(({ o }) => isOverdue(o.status, o.deliveryDate)).length,
    ready: rows.filter(({ o }) => o.status === "ready").length,
    delivered: rows.filter(({ o }) => o.status === "delivered").length,
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="অর্ডার ব্যবস্থাপনা"
        title="অর্ডার তালিকা"
        sub={`প্রতি পৃষ্ঠায় ${PAGE_SIZE}টি অর্ডার — মোট ${filtered.length}টি পাওয়া গেছে।`}
        actions={
          <>
            <QrScanner />
            <Button asChild size="lg">
              <Link href="/admin/orders/new">+ নতুন অর্ডার</Link>
            </Button>
          </>
        }
      />

      {counts.overdue > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {counts.overdue}টি অর্ডার ডেডলাইন পেরিয়েছে —{" "}
            <Link href="/admin/orders/overdue" className="underline">
              ওভারডিউ তালিকা দেখুন
            </Link>
            ।
          </AlertDescription>
        </Alert>
      )}

      {/* filter card — every control is exactly h-10, so nothing sits crooked */}
      <Card>
        <CardContent className="pt-5">
          <form method="get" className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
            <input type="hidden" name="page" value="1" />
            {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="or-q">খোঁজ (অর্ডার নং / নাম / ফোন)</Label>
              <Input
                id="or-q"
                name="q"
                defaultValue={q}
                placeholder="TP-2611-0042 বা রহিমউদ্দিন"
                className="h-10"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>স্ট্যাটাস</Label>
              <Select name="status" defaultValue={status || "all"}>
                <SelectTrigger aria-label="স্ট্যাটাস" className="h-10">
                  <SelectValue placeholder="সব স্ট্যাটাস" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.labelBn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="h-10">
              খুঁজুন
            </Button>
            <Button asChild type="button" variant="outline" className="h-10">
              <Link href="/admin/orders">রিসেট</Link>
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Button
                key={t.key}
                asChild
                variant={tab === t.key ? "default" : "outline"}
                size="sm"
                className="h-9"
              >
                <Link
                  href={
                    t.key === "all"
                      ? "/admin/orders"
                      : `/admin/orders?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}`
                  }
                >
                  {t.label}
                  <span className="num ml-1.5 opacity-75">
                    {counts[t.key as keyof typeof counts]}
                  </span>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>অর্ডার নং</TableHead>
                <TableHead>কাস্টমার</TableHead>
                <TableHead>পোশাক</TableHead>
                <TableHead>স্ট্যাটাস</TableHead>
                <TableHead>অর্ডার</TableHead>
                <TableHead>ডেলিভারি</TableHead>
                <TableHead className="text-right">মোট</TableHead>
                <TableHead className="text-right">বকেয়া</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-ink-3">
                    কোনো অর্ডার পাওয়া যায়নি।
                  </TableCell>
                </TableRow>
              )}
              {visible.map(({ o, c }) => {
                const late = isOverdue(o.status, o.deliveryDate);
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/admin/orders/${o.id}`} className="chalk-link num font-medium">
                        {o.orderNo}
                      </Link>
                      <div className="mt-1 flex gap-1.5">
                        {o.priority === "urgent" && <UrgentBadge />}
                        {o.type === "alteration" && <Badge variant="secondary">অল্টারেশন</Badge>}
                        {o.source === "online" && <Badge variant="gold">অনলাইন</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.name}
                      <span className="num block text-[12.5px] text-stone">
                        {c.phone.replace("+88", "")}
                      </span>
                    </TableCell>
                    <TableCell className="text-ink-3">
                      {(byOrder.get(o.id) ?? []).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="num text-ink-3">{dateShort(o.orderDate)}</TableCell>
                    <TableCell className={late ? "text-chalk" : ""}>
                      <span className="num">{dateShort(o.deliveryDate)}</span>
                      <span className="block text-[12.5px]">
                        {late
                          ? `${Math.abs(daysUntil(o.deliveryDate) ?? 0)} দিন দেরি`
                          : relativeDay(o.deliveryDate)}
                      </span>
                    </TableCell>
                    <TableCell className="num text-right">
                      {Number(o.total).toLocaleString("en-US")}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(o.dueAmount) > 0 ? (
                        <DueBadge due={o.dueAmount} />
                      ) : (
                        <span className="text-stone">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="-mx-5">
            <Pagination
              page={safePage}
              totalPages={totalPages}
              basePath="/admin/orders"
              params={{ q: q || undefined, status: status || undefined, tab: tab !== "all" ? tab : undefined }}
              total={filtered.length}
              label="অর্ডার"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
