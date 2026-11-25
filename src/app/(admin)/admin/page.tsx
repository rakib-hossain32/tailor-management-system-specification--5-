import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { Sparkles, Scissors, CheckCircle2, Clock, Users } from "lucide-react";
import { QuickActions } from "@/components/QuickActions";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { db } from "@/db";
import {
  appointments,
  customers,
  fabrics,
  garmentTypes,
  orderItems,
  orders,
  payments,
  settings,
  tasks,
  workers,
} from "@/db/schema";
import { StatusBadge, DueBadge, UrgentBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateShort, daysUntil, isoDate, relativeDay, startOfToday, taka } from "@/lib/format";
import { isOverdue } from "@/lib/order-status";
import { autoDistributeTasks, moveTask, updateAssignmentPolicy } from "./actions";

export const dynamic = "force-dynamic";

const STAGE_BN: Record<string, string> = {
  cutting: "কাটিং",
  stitching: "সেলাই",
  finishing: "ফিনিশিং",
  buttoning: "বোতাম",
  alteration: "সংশোধন",
};

const ROLE_BN: Record<string, string> = {
  cutting: "কাটার",
  stitching: "সেলাই কারিগর",
  finishing: "ফিনিশার",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const today = startOfToday();
  const todayISO = isoDate(today);
  const in3 = isoDate(new Date(today.getTime() + 3 * 86_400_000));

  const [
    rows,
    itemRows,
    todayPayments,
    apptRows,
    fabricRows,
    allWorkers,
    openTasks,
    policyRow,
  ] = await Promise.all([
    db
      .select({ o: viewFields(orders), c: viewFields(customers) })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .orderBy(orders.deliveryDate)
      .limit(500),
    db
      .select({ oi: orderItems, g: viewFields(garmentTypes) })
      .from(orderItems)
      .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
      .limit(2000),
    db
      .select({ amount: payments.amount })
      .from(payments)
      .where(gte(payments.receivedAt, today)),
    db
      .select()
      .from(appointments)
      .where(
        and(
          gte(appointments.startsAt, today),
          lt(appointments.startsAt, new Date(today.getTime() + 86_400_000)),
        ),
      )
      .orderBy(appointments.startsAt)
      .limit(8),
    db.select().from(fabrics),
    db
      .select()
      .from(workers)
      .where(eq(workers.isActive, true))
      .orderBy(asc(workers.name)),
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
      .where(inArray(tasks.status, ["assigned", "in_progress", "rework"]))
      .orderBy(asc(orders.deliveryDate), asc(tasks.assignedAt))
      .limit(80),
    db.select().from(settings).where(eq(settings.key, "assignment_policy")).limit(1),
  ]);

  const savedPolicy = ((policyRow[0]?.value as { mode?: string } | undefined)?.mode ?? "auto") as
    | "auto"
    | "manual"
    | "unassigned";

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const it of itemRows) {
    const key = it.oi.orderId;
    if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
    itemsByOrder.get(key)!.push(it);
  }

  const active = rows.filter((r) => !["delivered", "cancelled"].includes(r.o.status));
  const newToday = rows.filter((r) => r.o.orderDate === todayISO);
  const dueToday = active.filter((r) => r.o.deliveryDate === todayISO);
  const overdue = active.filter((r) => isOverdue(r.o.status, r.o.deliveryDate));
  const incomeToday = todayPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = active.reduce((s, r) => s + Number(r.o.dueAmount), 0);

  const ledger = [
    ...overdue.sort((a, b) => a.o.deliveryDate.localeCompare(b.o.deliveryDate)),
    ...active
      .filter((r) => !overdue.includes(r))
      .filter((r) => r.o.deliveryDate <= in3)
      .sort((a, b) => a.o.deliveryDate.localeCompare(b.o.deliveryDate)),
    ...active
      .filter((r) => r.o.deliveryDate > in3)
      .sort((a, b) => a.o.deliveryDate.localeCompare(b.o.deliveryDate)),
  ].slice(0, 12);

  const lowStock = fabricRows
    .filter((f) => Number(f.stockQty) <= Number(f.reorderLevel))
    .sort((a, b) => Number(a.stockQty) - Number(b.stockQty));

  const workerById = new Map(allWorkers.map((w) => [w.id, w]));
  const loadByWorkerId = new Map<string, number>();
  for (const w of allWorkers) loadByWorkerId.set(w.id, 0);
  for (const row of openTasks) {
    if (row.t.workerId && loadByWorkerId.has(row.t.workerId)) {
      loadByWorkerId.set(row.t.workerId, (loadByWorkerId.get(row.t.workerId) ?? 0) + 1);
    }
  }

  const unassignedTasks = openTasks.filter((r) => !r.t.workerId);
  const displayTasks = [
    ...unassignedTasks,
    ...openTasks.filter((r) => Boolean(r.t.workerId)),
  ].slice(0, 8);

  const kpis = [
    { label: "আজকের নতুন অর্ডার", value: String(newToday.length), sub: "নতুন এন্ট্রি" },
    { label: "আজ ডেলিভারি", value: String(dueToday.length), sub: "হাতে দিতে হবে" },
    { label: "ওভারডিউ", value: String(overdue.length), sub: "দেরি হয়েছে", alert: overdue.length > 0 },
    { label: "আজকের আয়", value: taka(incomeToday), sub: "ক্যাশ + ডিজিটাল" },
    { label: "মোট বকেয়া", value: taka(totalDue), sub: `${active.length}টি খোলা অর্ডার` },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="smallcaps text-stone">অ্যাডমিন কন্ট্রোল সেন্টার</div>
          <h1 className="mt-1 text-3xl sm:text-4xl">দোকানের দৈনন্দিন হিসাব ও কাজ বণ্টন</h1>
          <p className="mt-1 text-[15px] text-ink-3">
            {dateShort(today)} · শুক্রবার ছুটি বাদে প্রতিদিন সকাল ১০টা – রাত ৯টা
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <BarcodeScanner />
          <Button asChild size="default">
            <Link href="/admin/orders/new">+ নতুন অর্ডার</Link>
          </Button>
          <Button asChild variant="outline" size="default">
            <Link href="/admin/tasks">কাজ বণ্টন বোর্ড</Link>
          </Button>
          <QuickActions />
        </div>
      </header>

      {(sp.ok || sp.error) && (
        <Alert variant={sp.error ? "destructive" : "success"}>
          <AlertDescription>{sp.error ?? sp.ok}</AlertDescription>
        </Alert>
      )}

      {/* KPI Strip */}
      <Card className="overflow-hidden">
        <div className="ticks-h h-1.5" />
        <div className="grid grid-cols-2 divide-ink/10 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
          {kpis.map((k) => (
            <div key={k.label} className="border-b border-ink/10 px-5 py-4 lg:border-b-0">
              <div className="smallcaps text-stone">{k.label}</div>
              <div
                className={`num mt-1.5 text-[26px] leading-none font-semibold ${
                  k.alert ? "text-chalk" : "text-ink"
                }`}
              >
                {k.value}
              </div>
              <div className="mt-1.5 text-[13px] text-ink-3">{k.sub}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ==================== WORKER TASK ASSIGNMENT & AUTO-DISTRIBUTION HUB ==================== */}
      <Card className="border-gold/40 bg-gradient-to-b from-white to-paper/60">
        <CardHeader className="border-b border-ink/10 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Scissors className="size-4 text-gold-dark" />
                <span className="smallcaps text-gold-dark">কারিগর কাজ বণ্টন ও অটো-অ্যাসাইনমেন্ট</span>
              </div>
              <CardTitle className="mt-1 text-2xl">
                কারিগরকে দায়িত্ব বণ্টন (স্বয়ংক্রিয় একটার পর একটা / ম্যানুয়াল / ঐচ্ছিক)
              </CardTitle>
              <CardDescription className="mt-1">
                চাইলে এক ক্লিকে কাজের চাপ অনুযায়ী একটার পর একটা কারিগরকে স্বয়ংক্রিয়ভাবে কাজ বণ্টন করতে পারেন, নিজে পছন্দমতো কারিগর বেছে দিতে পারেন, অথবা বণ্টন ছাড়া রাখতে পারেন।
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* 1-Click Auto Distribute All Unassigned Tasks */}
              <form action={autoDistributeTasks}>
                <input type="hidden" name="return_path" value="/admin" />
                <Button type="submit" variant="gold">
                  <Sparkles className="size-4" />
                  স্বয়ংক্রিয়ভাবে সব কাজ বণ্টন করুন
                </Button>
              </form>

              {/* Default Policy Switcher */}
              <form action={updateAssignmentPolicy} className="flex items-center gap-2">
                <input type="hidden" name="return_path" value="/admin" />
                <Select name="mode" defaultValue={savedPolicy}>
                  <SelectTrigger className="w-[230px]" aria-label="ডিফল্ট কাজ বণ্টন নীতি">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">নীতি: স্বয়ংক্রিয় (একটার পর একটা)</SelectItem>
                    <SelectItem value="manual">নীতি: ম্যানুয়াল (নিজে বেছে দেওয়া)</SelectItem>
                    <SelectItem value="unassigned">নীতি: বণ্টন ছাড়া রাখা</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" variant="outline">
                  নীতি সেভ
                </Button>
              </form>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {/* Worker live queue summary chips */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {allWorkers.map((w) => {
              const count = loadByWorkerId.get(w.id) ?? 0;
              return (
                <Link
                  key={w.id}
                  href={`/admin/workers/${w.id}`}
                  className="flex items-center justify-between rounded-md border border-ink/12 bg-white px-3.5 py-2.5 transition-colors hover:border-gold"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-medium text-ink">{w.name}</div>
                    <div className="text-[12px] text-stone">{ROLE_BN[w.role] ?? w.role}</div>
                  </div>
                  <Badge variant={count > 3 ? "destructive" : count > 0 ? "gold" : "secondary"} className="num">
                    {count}টি কাজ
                  </Badge>
                </Link>
              );
            })}
          </div>

          {/* Interactive Task Assignment Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>অর্ডার ও পোশাক</TableHead>
                <TableHead>কাজের ধাপ</TableHead>
                <TableHead>ডেলিভারি</TableHead>
                <TableHead>বর্তমান কারিগর</TableHead>
                <TableHead className="text-right">কারিগর নির্বাচন / বণ্টন পরিবর্তন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-ink-3">
                    বর্তমানে কোনো চলমান টাস্ক নেই। উপরের “স্বয়ংক্রিয়ভাবে সব কাজ বণ্টন করুন” বাটনে ক্লিক করলে খোলা অর্ডারের টাস্ক তৈরি ও বণ্টন হবে।
                  </TableCell>
                </TableRow>
              )}
              {displayTasks.map(({ t, orderId, orderNo, delivery, orderStatus, garment, qty }) => {
                const currentWorker = t.workerId ? workerById.get(t.workerId) : undefined;
                const roleWorkers = allWorkers.filter((w) => w.role === t.stage);
                const candidateWorkers = roleWorkers.length > 0 ? roleWorkers : allWorkers;
                const late = isOverdue(orderStatus, delivery);

                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/admin/orders/${orderId}`} className="chalk-link code font-medium">
                        {orderNo}
                      </Link>
                      <span className="ml-2 text-ink-3">
                        {garment} <span className="num text-stone">×{qty}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{STAGE_BN[t.stage] ?? t.stage}</Badge>
                    </TableCell>
                    <TableCell className={`num ${late ? "font-semibold text-chalk" : "text-ink-3"}`}>
                      {dateShort(delivery)}
                    </TableCell>
                    <TableCell>
                      {currentWorker ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                          <CheckCircle2 className="size-3.5 text-[#1D6B3F]" />
                          {currentWorker.name}
                        </span>
                      ) : (
                        <Badge variant="warning">
                          <Clock className="size-3" /> বণ্টন করা হয়নি
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {/* Manual select or unassign */}
                        <form action={moveTask} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="action" value="assign" />
                          <input type="hidden" name="return_path" value="/admin" />
                          <Select name="worker_id" defaultValue={t.workerId ?? "unassigned"}>
                            <SelectTrigger className="w-[190px]" aria-label="কারিগর বাছুন">
                              <SelectValue placeholder="কারিগর বাছুন" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">— বণ্টন ছাড়া রাখুন —</SelectItem>
                              {candidateWorkers.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                  {w.name} ({loadByWorkerId.get(w.id) ?? 0})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="submit" size="default" variant="default">
                            বণ্টন করুন
                          </Button>
                        </form>

                        {/* 1-click Auto for this single task */}
                        {!t.workerId && (
                          <form action={autoDistributeTasks}>
                            <input type="hidden" name="task_id" value={t.id} />
                            <input type="hidden" name="return_path" value="/admin" />
                            <Button type="submit" variant="gold" size="default" title="স্বয়ংক্রিয়ভাবে কম চাপের কারিগরকে দিন">
                              <Sparkles className="size-3.5" />
                              অটো
                            </Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ==================== LEDGER + SIDE COLUMN ==================== */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        {/* Open Orders Ledger */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-ink/10 pb-3.5">
            <div>
              <CardTitle className="text-xl">খোলা অর্ডার — ডেডলাইন অনুযায়ী</CardTitle>
              <CardDescription>ওভারডিউ এবং আসন্ন ডেলিভারি সবার উপরে</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/orders">সব অর্ডার →</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>অর্ডার নং</TableHead>
                  <TableHead>কাস্টমার</TableHead>
                  <TableHead>পোশাক</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead>ডেলিভারি</TableHead>
                  <TableHead className="text-right">বকেয়া</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-ink-3">
                      এখন কোনো খোলা অর্ডার নেই।
                    </TableCell>
                  </TableRow>
                )}
                {ledger.map(({ o, c }) => {
                  const its = itemsByOrder.get(o.id) ?? [];
                  const late = isOverdue(o.status, o.deliveryDate);
                  const days = daysUntil(o.deliveryDate);
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/admin/orders/${o.id}`} className="chalk-link code font-medium text-ink">
                          {o.orderNo}
                        </Link>
                        <div className="mt-1 flex gap-1.5">
                          {o.priority === "urgent" && <UrgentBadge />}
                          {o.source === "online" && <Badge variant="gold">অনলাইন</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{c.name}</div>
                        <div className="num text-[12.5px] text-stone">{c.phone.replace("+88", "")}</div>
                      </TableCell>
                      <TableCell className="text-ink-3">
                        {its.length === 0 ? "—" : its.map((i) => i.g.nameBn).join(", ")}
                        {its.length > 0 && (
                          <span className="num ml-1.5 text-[12px] text-stone">×{its[0].oi.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                      <TableCell>
                        <div className={`num ${late ? "font-semibold text-chalk" : ""}`}>
                          {dateShort(o.deliveryDate)}
                        </div>
                        <div className={`text-[12.5px] ${late ? "text-chalk" : "text-stone"}`}>
                          {late ? `${Math.abs(days ?? 0)} দিন দেরি` : relativeDay(o.deliveryDate)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(o.dueAmount) > 0 ? (
                          <DueBadge due={o.dueAmount} />
                        ) : (
                          <Badge variant="success">✓ পরিশোধিত</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Side Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-ink/10 pb-3.5">
              <CardTitle className="text-xl">আজকের অ্যাপয়েন্টমেন্ট</CardTitle>
              <Link href="/admin/appointments" className="chalk-link text-[13.5px] text-gold-dark">
                ক্যালেন্ডার →
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              <ul className="divide-y divide-ink/10">
                {apptRows.length === 0 && (
                  <li className="py-5 text-[14.5px] text-ink-3">আজ কোনো অ্যাপয়েন্টমেন্ট নেই।</li>
                )}
                {apptRows.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <span className="num rounded-md bg-ink px-2.5 py-1 text-[13px] text-paper">
                      {new Date(a.startsAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Dhaka",
                      })}
                    </span>
                    <span className="flex-1 text-[14.5px]">
                      {a.name}
                      <span className="block text-[12.5px] text-stone">{a.purpose}</span>
                    </span>
                    <StatusBadge status={a.status === "confirmed" ? "confirmed" : "draft"} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-ink/10 pb-3.5">
              <CardTitle className="text-xl">লো-স্টক কাপড়ের সতর্কতা</CardTitle>
              <Link href="/admin/inventory" className="chalk-link text-[13.5px] text-gold-dark">
                স্টক দেখুন →
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              <ul className="divide-y divide-ink/10">
                {lowStock.length === 0 && (
                  <li className="py-5 text-[14.5px] text-ink-3">সব কাপড়ের স্টক যথেষ্ট আছে।</li>
                )}
                {lowStock.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-2.5 text-[14.5px]">
                    <span className="flex-1">
                      {f.name}
                      <span className="code ml-2 text-[12.5px] text-stone">{f.code}</span>
                    </span>
                    <Badge variant="destructive" className="num">
                      {Number(f.stockQty)} {f.unit === "yard" ? "গজ" : "মিটার"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
