import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Sparkles, CheckCircle2, Clock, ArrowUpDown } from "lucide-react";
import { db } from "@/db";
import { garmentTypes, orderItems, orders, tasks, workers } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { Pagination } from "@/components/admin/Pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateShort } from "@/lib/format";
import { isOverdue } from "@/lib/order-status";
import { autoDistributeTasks, moveTask } from "../actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const STAGE_BN: Record<string, string> = {
  cutting: "কাটিং",
  stitching: "সেলাই",
  finishing: "ফিনিশিং",
  buttoning: "বোতাম",
  alteration: "সংশোধন",
};

const COLUMNS: { key: string; title: string; statuses: string[] }[] = [
  { key: "assigned", title: "অ্যাসাইন / অপেক্ষমাণ", statuses: ["assigned", "rework"] },
  { key: "progress", title: "কাজ চলছে", statuses: ["in_progress"] },
  { key: "done", title: "শেষ — QC বাকি", statuses: ["done"] },
  { key: "passed", title: "যাচাই পাস", statuses: ["qc_passed"] },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ worker?: string; page?: string; ok?: string; error?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [allRows, workerRows] = await Promise.all([
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
      .orderBy(asc(tasks.assignedAt))
      .limit(600),
    db.select().from(workers).where(eq(workers.isActive, true)).orderBy(asc(workers.name)),
  ]);

  const filtered = sp.worker
    ? sp.worker === "unassigned"
      ? allRows.filter((r) => !r.t.workerId)
      : allRows.filter((r) => r.t.workerId === sp.worker)
    : allRows;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const byStatus = (statuses: string[]) => rows.filter((r) => statuses.includes(r.t.status));
  const openCount = filtered.filter((r) =>
    ["assigned", "in_progress", "done", "rework"].includes(r.t.status),
  ).length;
  const unassignedCount = filtered.filter((r) => !r.t.workerId).length;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="কাজ বণ্টন ও QC"
        title="কারিগরের কাজের বোর্ড"
        sub={`প্রতি পৃষ্ঠায় সর্বোচ্চ ${PAGE_SIZE}টি কাজ দেখানো হয় — এতে ফ্রন্টএন্ড ও সার্ভার দুটোই হালকা থাকে। মোট ${filtered.length}টি কাজ, ${openCount}টি চলমান এবং ${unassignedCount}টি অবণ্টিত।`}
        actions={
          <>
            <form action={autoDistributeTasks}>
              <input type="hidden" name="return_path" value="/admin/tasks" />
              <Button type="submit" variant="gold">
                <Sparkles className="size-4" />
                স্বয়ংক্রিয় বণ্টন
              </Button>
            </form>
            <Button asChild variant="outline">
              <Link href="/admin/workers">কারিগর তালিকা</Link>
            </Button>
            <Button asChild variant="default">
              <Link href="/admin/orders/board">কানবান বোর্ড</Link>
            </Button>
          </>
        }
      />

      {(sp.ok || sp.error) && (
        <Alert variant={sp.error ? "destructive" : "success"}>
          <AlertDescription>{sp.error ?? sp.ok}</AlertDescription>
        </Alert>
      )}

      {/* filter bar — every control is h-10 so nothing sits crooked */}
      <Card>
        <CardContent className="pt-5">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="page" value="1" />
            <div className="w-full sm:w-[260px]">
              <Select name="worker" defaultValue={sp.worker ?? "all"}>
                <SelectTrigger aria-label="কারিগর ফিল্টার" className="h-10">
                  <SelectValue placeholder="সবার কাজ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সবার কাজ ({allRows.length})</SelectItem>
                  <SelectItem value="unassigned">বণ্টন ছাড়া ({allRows.filter((r) => !r.t.workerId).length})</SelectItem>
                  {workerRows.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="h-10">
              ফিল্টার করুন
            </Button>
            <Button asChild type="button" variant="outline" className="h-10">
              <Link href="/admin/tasks">রিসেট</Link>
            </Button>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[13.5px] text-stone">
              <ArrowUpDown className="size-3.5" />
              ডেডলাইন অনুযায়ী সাজানো
            </span>
          </form>
        </CardContent>
      </Card>

      {/* 4 columns — only the current page's rows are rendered */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = byStatus(col.statuses);
          return (
            <section
              key={col.key}
              className="paper-card flex min-h-[240px] flex-col"
            >
              <div className="flex items-center justify-between border-b border-ink/12 px-4 py-3">
                <h2 className="text-[16.5px] font-medium">{col.title}</h2>
                <Badge variant="default" className="num">
                  {list.length}
                </Badge>
              </div>
              <div className="flex-1 space-y-3 p-3">
                {list.length === 0 && <Empty>এই কলামে পৃষ্ঠায় কিছু নেই।</Empty>}
                {list.map(({ t, orderId, orderNo, delivery, orderStatus, garment, qty }) => {
                  const late = isOverdue(orderStatus, delivery);
                  const worker = workerRows.find((w) => w.id === t.workerId);
                  return (
                    <article
                      key={t.id}
                      className="min-w-0 rounded-md border border-ink/12 bg-paper/60 p-3 shadow-2xs"
                    >
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <Link
                          href={`/admin/orders/${orderId}`}
                          className="chalk-link num truncate text-[14px] font-medium"
                        >
                          {orderNo}
                        </Link>
                        <Badge variant="outline" className="shrink-0">
                          {STAGE_BN[t.stage] ?? t.stage}
                        </Badge>
                      </div>
                      <div className="mt-1.5 truncate text-[15px] font-medium">
                        {garment} <span className="num text-stone">×{qty}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
                        <span className={late ? "font-medium text-chalk" : "text-stone"}>
                          {dateShort(delivery)} {late && "· দেরি"}
                        </span>
                        <span className="num font-medium text-gold-dark">
                          ৳{Number(t.pieceRate ?? 0)}
                        </span>
                      </div>

                      <div className="mt-2 text-[13.5px]">
                        {worker ? (
                          <span className="inline-flex items-center gap-1 text-ink">
                            <CheckCircle2 className="size-3.5 text-[#1D6B3F]" />
                            {worker.name}
                          </span>
                        ) : (
                          <Badge variant="warning">
                            <Clock className="size-3" /> বণ্টন ছাড়া
                          </Badge>
                        )}
                      </div>

                      {/* actions stack vertically — no horizontal overflow */}
                      <div className="mt-3 space-y-2 border-t border-ink/10 pt-2.5">
                        {["assigned", "rework"].includes(t.status) && (
                          <form action={moveTask} className="space-y-1.5">
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="action" value="assign" />
                            <input type="hidden" name="return_path" value={`/admin/tasks?worker=${sp.worker ?? "all"}&page=${safePage}`} />
                            <Select name="worker_id" defaultValue={t.workerId ?? "unassigned"}>
                              <SelectTrigger
                                className="h-10 w-full text-[14px]"
                                aria-label="কারিগর পরিবর্তন"
                              >
                                <SelectValue placeholder="কারিগর বাছুন" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">— বণ্টন ছাড়া —</SelectItem>
                                {workerRows.map((w) => (
                                  <SelectItem key={w.id} value={w.id}>
                                    {w.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button type="submit" className="h-10 w-full" variant="outline">
                              কারিগর সেভ করুন
                            </Button>
                          </form>
                        )}

                        <div className="flex flex-col gap-1.5">
                          {(t.status === "assigned" || t.status === "rework") && t.workerId && (
                            <form action={moveTask}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="action" value="start" />
                              <input
                                type="hidden"
                                name="return_path"
                                value={`/admin/tasks?worker=${sp.worker ?? "all"}&page=${safePage}`}
                              />
                              <Button type="submit" className="h-10 w-full">
                                শুরু করলাম
                              </Button>
                            </form>
                          )}

                          {!t.workerId && (
                            <form action={autoDistributeTasks}>
                              <input type="hidden" name="task_id" value={t.id} />
                              <input
                                type="hidden"
                                name="return_path"
                                value={`/admin/tasks?worker=${sp.worker ?? "all"}&page=${safePage}`}
                              />
                              <Button type="submit" variant="gold" className="h-10 w-full">
                                <Sparkles className="size-4" /> অটো বণ্টন
                              </Button>
                            </form>
                          )}

                          {t.status === "in_progress" && (
                            <form action={moveTask}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="action" value="done" />
                              <input
                                type="hidden"
                                name="return_path"
                                value={`/admin/tasks?worker=${sp.worker ?? "all"}&page=${safePage}`}
                              />
                              <Button type="submit" className="h-10 w-full">
                                শেষ করলাম
                              </Button>
                            </form>
                          )}

                          {t.status === "done" && (
                            <div className="grid grid-cols-2 gap-1.5">
                              <form action={moveTask}>
                                <input type="hidden" name="id" value={t.id} />
                                <input type="hidden" name="action" value="qc" />
                                <input
                                  type="hidden"
                                  name="return_path"
                                  value={`/admin/tasks?worker=${sp.worker ?? "all"}&page=${safePage}`}
                                />
                                <Button
                                  type="submit"
                                  className="h-10 w-full bg-[#1D6B3F] text-white hover:bg-[#1D6B3F]/90"
                                >
                                  ✓ QC পাস
                                </Button>
                              </form>
                              <form action={moveTask}>
                                <input type="hidden" name="id" value={t.id} />
                                <input type="hidden" name="action" value="rework" />
                                <input
                                  type="hidden"
                                  name="return_path"
                                  value={`/admin/tasks?worker=${sp.worker ?? "all"}&page=${safePage}`}
                                />
                                <Button type="submit" variant="destructive" className="h-10 w-full">
                                  রিওয়ার্ক
                                </Button>
                              </form>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="paper-card overflow-hidden">
        <Pagination
          page={safePage}
          totalPages={totalPages}
          basePath="/admin/tasks"
          params={{ worker: sp.worker }}
          total={filtered.length}
          label="কাজ"
        />
      </div>
    </div>
  );
}
