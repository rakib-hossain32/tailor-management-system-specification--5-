import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customers, garmentTypes, orderItems, orders } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { QuickStatus } from "@/components/QuickStatus";
import { StatusBadge, UrgentBadge } from "@/components/StatusBadge";
import { dateShort, daysUntil, relativeDay } from "@/lib/format";
import { isOverdue, ORDER_STATUSES } from "@/lib/order-status";

export const dynamic = "force-dynamic";

const BOARD_COLUMNS = [
  { key: "requested", title: "অনুরোধ", statuses: ["requested", "draft"] },
  { key: "confirmed", title: "অর্ডার প্রাপ্ত", statuses: ["confirmed"] },
  { key: "cutting", title: "কাটিং", statuses: ["cutting", "on_hold"] },
  { key: "stitching", title: "সেলাই", statuses: ["stitching"] },
  { key: "finishing", title: "ফিনিশিং", statuses: ["finishing", "alteration", "trial_ready"] },
  { key: "ready", title: "রেডি", statuses: ["ready"] },
];

export default async function BoardPage() {
  await requireAdminPage();
  const rows = await db
    .select({ o: viewFields(orders), c: viewFields(customers) })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(
      inArray(orders.status, BOARD_COLUMNS.flatMap((c) => c.statuses)),
    )
    .orderBy(desc(orders.deliveryDate))
    .limit(300);

  const items = await db
    .select({ oi: orderItems, g: viewFields(garmentTypes) })
    .from(orderItems)
    .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id));
  const byOrder = new Map<string, { name: string; qty: number }[]>();
  for (const it of items) {
    const arr = byOrder.get(it.oi.orderId) ?? [];
    arr.push({ name: it.g.nameBn, qty: it.oi.quantity });
    byOrder.set(it.oi.orderId, arr);
  }

  const overdueCount = rows.filter(({ o }) => isOverdue(o.status, o.deliveryDate)).length;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="কানবান বোর্ড"
        title="অর্ডার পাইপলাইন"
        sub="কার্ড ড্র্যাগ নয় — প্রতিটি কার্ডের “ধাপ বদলান” বাটন স্টেট মেশিন যাচাই করে স্ট্যাটাস বদলায় এবং ইতিহাসে লগ করে।"
        actions={
          <>
            <span className="rounded-sm border border-ink/25 px-4 py-2.5 text-[15px]">
              খোলা <b className="num">{rows.length}</b>
            </span>
            <span className={`rounded-sm px-4 py-2.5 text-[15px] ${overdueCount ? "bg-chalk text-paper" : "border border-ink/25"}`}>
              ওভারডিউ <b className="num">{overdueCount}</b>
            </span>
            <Link href="/admin/orders" className="rounded-sm border border-ink/30 px-4 py-2.5 text-[15px] hover:bg-ink/5">
              তালিকা
            </Link>
          </>
        }
      />

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="grid min-w-[1080px] grid-cols-6 gap-3">
          {BOARD_COLUMNS.map((col) => {
            const list = rows.filter(({ o }) => col.statuses.includes(o.status));
            return (
              <section key={col.key} className="paper-card flex min-h-[320px] flex-col">
                <div className="flex items-center justify-between border-b border-ink/15 px-3 py-2.5">
                  <h2 className="text-[15.5px] font-medium">{col.title}</h2>
                  <span className="num rounded-full bg-ink px-2 py-0.5 text-[12px] text-paper">{list.length}</span>
                </div>
                <div className="flex-1 space-y-2.5 p-2.5">
                  {list.length === 0 && <p className="py-6 text-center text-[13.5px] text-stone">খালি</p>}
                  {list.map(({ o, c }) => {
                    const late = isOverdue(o.status, o.deliveryDate);
                    const days = daysUntil(o.deliveryDate);
                    const garments = byOrder.get(o.id) ?? [];
                    return (
                      <article
                        key={o.id}
                        className={`rounded-sm border bg-paper p-2.5 ${
                          late ? "border-chalk/60" : "border-envelope"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <Link href={`/admin/orders/${o.id}`} className="chalk-link num text-[13.5px]">
                            {o.orderNo.slice(-7)}
                          </Link>
                          {o.priority === "urgent" && <UrgentBadge />}
                        </div>
                        <div className="mt-1 text-[15px] leading-tight">{c.name}</div>
                        <div className="mt-1 text-[13.5px] text-ink-3">
                          {garments.map((g) => `${g.name} ×${g.qty}`).join(", ") || "—"}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[13px]">
                          <span className={`num ${late ? "font-semibold text-chalk" : "text-stone"}`}>
                            {dateShort(o.deliveryDate)}
                          </span>
                          <span className={late ? "text-chalk" : "text-stone"}>
                            {late ? `${Math.abs(days ?? 0)} দিন দেরি` : relativeDay(o.deliveryDate)}
                          </span>
                        </div>
                        {Number(o.dueAmount) > 0 && (
                          <div className="num mt-1 inline-block rounded-sm bg-chalk-light px-1.5 py-0.5 text-[12px] text-chalk">
                            বকেয়া ৳{Math.round(Number(o.dueAmount)).toLocaleString("en-US")}
                          </div>
                        )}
                        <div className="mt-2">
                          <QuickStatus orderId={o.id} current={o.status} due={Number(o.dueAmount)} compact />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="smallcaps text-stone">সব স্ট্যাটাস:</span>
        {ORDER_STATUSES.map((s) => (
          <StatusBadge key={s.code} status={s.code} />
        ))}
      </div>
      {rows.length === 0 && <Empty>কোনো খোলা অর্ডার নেই।</Empty>}
    </div>
  );
}
