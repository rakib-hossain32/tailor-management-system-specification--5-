import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import {
  PlayCircle,
  CheckCircle2,
  ClipboardList,
  Banknote,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { db } from "@/db";
import { garmentTypes, orderItems, orders, tasks, workers } from "@/db/schema";
import { Pagination } from "@/components/admin/Pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dateShort, daysUntil, relativeDay } from "@/lib/format";
import { isOverdue } from "@/lib/order-status";
import { moveTask } from "@/app/(admin)/admin/actions";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/access";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

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

export default async function WorkerHome({
  searchParams,
}: {
  searchParams: Promise<{ w?: string; tab?: string; page?: string }>;
}) {
  const sp = await searchParams;

  const session = await getStaffSession();
  if (!session || session.role !== "worker" || !session.workerId) redirect("/staff-login?next=/worker");
  const [active] = await db.select().from(workers).where(eq(workers.id, session.workerId)).limit(1);
  const tab = sp.tab ?? "today";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const allTasks = active
    ? await db
        .select({
          t: tasks,
          orderId: orders.id,
          orderNo: orders.orderNo,
          delivery: orders.deliveryDate,
          orderStatus: orders.status,
          garment: garmentTypes.nameBn,
          qty: orderItems.quantity,
          designNotes: orderItems.designNotes,
        })
        .from(tasks)
        .innerJoin(orderItems, eq(tasks.orderItemId, orderItems.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
        .where(eq(tasks.workerId, active.id))
        .orderBy(asc(orders.deliveryDate), asc(tasks.assignedAt))
        .limit(500)
    : [];

  const todayISO = new Date().toISOString().slice(0, 10);
  const open = allTasks.filter((t) => ["assigned", "in_progress", "rework"].includes(t.t.status));
  const todo = open.filter((t) => t.orderStatus !== "delivered");
  const doneToday = allTasks.filter(
    (t) =>
      t.t.completedAt &&
      new Date(t.t.completedAt).toISOString().slice(0, 10) === todayISO,
  );
  const earned = allTasks
    .filter((t) => t.t.status === "qc_passed")
    .reduce((s, t) => s + Number(t.t.pieceRate ?? 0), 0);

  const scoped =
    tab === "all"
      ? allTasks
      : tab === "done"
        ? allTasks.filter((t) => ["done", "qc_passed"].includes(t.t.status))
        : todo;

  const totalPages = Math.max(1, Math.ceil(scoped.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = scoped.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const params = { w: active?.id, tab };

  if (!active) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-ink-3">
          কোনো সক্রিয় কারিগর পাওয়া যায়নি।
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* identity + stats */}
      <Card className="overflow-hidden border-gold/40">
        <div className="ticks-h h-1.5" />
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="smallcaps text-stone">আজকের কাজ</div>
              <h1 className="mt-1 text-[30px] leading-tight sm:text-[36px]">{active.name}</h1>
              <p className="text-[15px] text-ink-3">
                {ROLE_BN[active.role] ?? active.role}
                {active.skillTags.length > 0 && ` · ${active.skillTags.join(", ")}`}
              </p>
            </div>

                        {session?.workerId ? (
              <div className="w-full sm:w-auto">
                <div className="smallcaps mb-1.5 text-stone">আপনার প্রোফাইল</div>
                <div className="rounded-full border border-gold/50 bg-gold-light/45 px-4 py-1.5 text-[14px] text-gold-dark">
                  {active.name} · শুধু আপনার কাজ
                </div>
              </div>
            ) : null}

          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "করার বাকি", v: String(todo.length), alert: todo.length > 0, icon: ClipboardList },
              { l: "আজ শেষ", v: String(doneToday.length), icon: CheckCircle2 },
              { l: "মোট সম্পন্ন", v: String(allTasks.filter((t) => ["done", "qc_passed"].includes(t.t.status)).length), icon: PlayCircle },
              { l: "জমা মজুরি", v: `৳${earned.toLocaleString("en-US")}`, icon: Banknote },
            ].map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.l} className="rounded-md border border-ink/12 bg-paper/60 p-3.5">
                  <div className="flex items-center gap-1.5 text-stone">
                    <Icon className="size-3.5" />
                    <span className="smallcaps">{k.l}</span>
                  </div>
                  <div
                    className={`num mt-1.5 text-[24px] leading-none font-semibold ${
                      k.alert ? "text-chalk" : "text-ink"
                    }`}
                  >
                    {k.v}
                  </div>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>

      {/* tabs */}
      <Tabs value={tab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="today" asChild>
            <Link href={`/worker?w=${active.id}&tab=today`}>করার বাকি ({todo.length})</Link>
          </TabsTrigger>
          <TabsTrigger value="all" asChild>
            <Link href={`/worker?w=${active.id}&tab=all`}>সব কাজ ({allTasks.length})</Link>
          </TabsTrigger>
          <TabsTrigger value="done" asChild>
            <Link href={`/worker?w=${active.id}&tab=done`}>
              সম্পন্ন ({allTasks.filter((t) => ["done", "qc_passed"].includes(t.t.status)).length})
            </Link>
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {visible.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-ink-3">
                {tab === "today" ? "✓ করার মতো কোনো কাজ বাকি নেই।" : "কোনো কাজ পাওয়া যায়নি।"}
              </CardContent>
            </Card>
          )}

          {visible.map(({ t, orderId, orderNo, delivery, orderStatus, garment, qty, designNotes }) => {
            const late = isOverdue(orderStatus, delivery);
            const days = daysUntil(delivery);
            const statusLabel =
              t.status === "rework"
                ? { label: "রিওয়ার্ক — আবার করুন", cls: "bg-chalk-light text-chalk" }
                : t.status === "in_progress"
                  ? { label: "চলছে", cls: "bg-[#FCE4CC] text-[#8A4B08]" }
                  : t.status === "done"
                    ? { label: "শেষ — যাচাই বাকি", cls: "bg-[#DCE9F8] text-[#1B4F8F]" }
                    : t.status === "qc_passed"
                      ? { label: "✓ যাচাই পাস", cls: "bg-[#D9F0E1] text-[#1D6B3F]" }
                      : { label: "শুরু করার অপেক্ষায়", cls: "bg-paper-3 text-ink-3" };

            return (
              <Card key={t.id} className={late ? "border-chalk/50" : ""}>
                <CardContent className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{STAGE_BN[t.stage] ?? t.stage}</Badge>
                        <span className={`rounded-full px-2.5 py-0.5 text-[13px] ${statusLabel.cls}`}>
                          {statusLabel.label}
                        </span>
                      </div>
                      <h2 className="mt-2 text-[24px] leading-tight">
                        {garment} <span className="num text-[18px] text-stone">×{qty}</span>
                      </h2>
                      <p className="num mt-1 text-[14.5px] text-ink-3">
                        অর্ডার {orderNo}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className={`num text-[17px] ${late ? "font-semibold text-chalk" : "text-ink"}`}>
                        {dateShort(delivery)}
                      </div>
                      <div className={`text-[13.5px] ${late ? "text-chalk" : "text-stone"}`}>
                        {late
                          ? `${Math.abs(days ?? 0)} দিন দেরি`
                          : relativeDay(delivery)}
                      </div>
                      <div className="num mt-1 text-[15px] font-semibold text-gold-dark">
                        ৳{Number(t.pieceRate ?? 0)}
                      </div>
                    </div>
                  </div>

                  {designNotes && (
                    <p className="mt-3 rounded-md border border-gold/50 bg-gold-light/40 px-3 py-2 text-[15px]">
                      বিশেষ নোট: {designNotes}
                    </p>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button asChild variant="outline" className="h-12 flex-1 text-[16px]">
                      <Link href={`/worker/tasks/${t.id}`}>বিস্তারিত ও মাপ দেখুন</Link>
                    </Button>

                    {(t.status === "assigned" || t.status === "rework") && (
                      <form action={moveTask} className="flex-1">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="action" value="start" />
                        <input type="hidden" name="return_path" value={`/worker?w=${active.id}&tab=${tab}&page=${safePage}`} />
                        <Button type="submit" className="h-12 w-full text-[16px]">
                          <PlayCircle className="size-5" />
                          শুরু করলাম
                        </Button>
                      </form>
                    )}

                    {t.status === "in_progress" && (
                      <form action={moveTask} className="flex-1">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="action" value="done" />
                        <input type="hidden" name="return_path" value={`/worker?w=${active.id}&tab=${tab}&page=${safePage}`} />
                        <Button
                          type="submit"
                          className="h-12 w-full bg-[#1D6B3F] text-[16px] text-white hover:bg-[#1D6B3F]/90"
                        >
                          <CheckCircle2 className="size-5" />
                          শেষ করলাম
                        </Button>
                      </form>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {scoped.length > PAGE_SIZE && (
            <Card className="overflow-hidden">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                basePath="/worker"
                params={params}
                total={scoped.length}
                label="কাজ"
              />
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[18px]">
              <Banknote className="size-4 text-gold-dark" />
              আমার আয়
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[15px] text-ink-3">
              ম্যানেজারের QC পাস হলে কাজের মজুরি জমা হয়।
            </p>
            <Button asChild variant="outline" className="mt-3">
              <Link href={`/worker/earnings?w=${active.id}`}>বিস্তারিত হিসাব →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[18px]">
              <AlertTriangle className="size-4 text-chalk" />
              সমস্যা জানান
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[15px] text-ink-3">
              কাপড় বা মাপে সমস্যা পেলে ম্যানেজারকে জানাতে হলে কাজের বিস্তারিত পাতায় নোট লিখুন।
            </p>
            <p className="num mt-2 text-[15px] text-gold-dark">হটলাইন: ০১৭১১-০০০০০১</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-[13.5px] text-stone">
        <Clock className="mr-1 inline size-3.5" />
        কাজ শেষ করলে ম্যানেজার QC করবেন; পাস হলে মজুরি যোগ হবে এবং অর্ডার পরবর্তী ধাপে যাবে।
      </p>
    </div>
  );
}
