import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, garmentTypes, orderItems, orders } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { StatusBadge, DueBadge, UrgentBadge } from "@/components/StatusBadge";
import { QuickStatus } from "@/components/QuickStatus";
import { dateShort, daysUntil, relativeDay } from "@/lib/format";
import { isOverdue } from "@/lib/order-status";

export const dynamic = "force-dynamic";

export default async function OverduePage() {
  await requireAdminPage();
  const rows = await db
    .select({ o: orders, c: customers })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(sql`${orders.status} not in ('delivered','cancelled')`)
    .orderBy(asc(orders.deliveryDate))
    .limit(300);

  const items = await db
    .select({ oi: orderItems, g: garmentTypes })
    .from(orderItems)
    .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id));
  const byOrder = new Map<string, string[]>();
  for (const it of items) {
    const arr = byOrder.get(it.oi.orderId) ?? [];
    if (!arr.includes(it.g.nameBn)) arr.push(it.g.nameBn);
    byOrder.set(it.oi.orderId, arr);
  }

  const late = rows.filter(({ o }) => isOverdue(o.status, o.deliveryDate));
  const next3 = rows.filter(({ o }) => {
    const d = daysUntil(o.deliveryDate);
    return !isOverdue(o.status, o.deliveryDate) && d !== null && d <= 3;
  });
  const totalDueLate = late.reduce((s, r) => s + Number(r.o.dueAmount), 0);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="ডেডলাইন"
        title="ওভারডিউ ও আসন্ন ডেলিভারি"
        sub="ডেলিভারি তারিখ পেরোগে যাওয়া অর্ডার সবার আগে। সঙ্গে দুই-তিন দিনের মধ্যে ডেলিভারি।"
        actions={
          <>
            <span className={`rounded-sm px-4 py-2.5 text-[15px] ${late.length ? "bg-chalk text-paper" : "border border-ink/25"}`}>
              ওভারডিউ <b className="num">{late.length}</b>
            </span>
            <span className="rounded-sm border border-ink/25 px-4 py-2.5 text-[15px]">
              আসন্ন <b className="num">{next3.length}</b>
            </span>
            <Link href="/admin/orders/board" className="rounded-sm bg-ink px-4 py-2.5 text-[15px] text-paper hover:bg-ink-2">
              কানবান বোর্ড
            </Link>
          </>
        }
      />

      {late.length > 0 && (
        <p className="rounded-sm border border-chalk/40 bg-chalk-light px-4 py-3 text-[15.5px] text-chalk">
          {late.length}টি অর্ডার দেরিতে — মোট বকেয়া ৳{Math.round(totalDueLate).toLocaleString("en-US")}। কাস্টমারকে
          ফোন/ SMS করে জানান।
        </p>
      )}

      {[
        { key: "late", title: "ওভারডিউ", list: late },
        { key: "soon", title: "আগামী ৩ দিনে ডেলিভারি", list: next3 },
      ].map((section) => (
        <section key={section.key} className="paper-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
            <h2 className="text-xl">{section.title}</h2>
            <span className="num text-[15px] text-stone">{section.list.length}টি</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[14.5px]">
              <thead>
                <tr className="border-b border-ink/25 text-left">
                  {["অর্ডার নং", "কাস্টমার", "পোশাক", "স্ট্যাটাস", "ডেলিভারি", "বকেয়া", "অ্যাকশন"].map((h) => (
                    <th key={h} className="smallcaps px-4 py-2.5 font-medium text-stone">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.list.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <Empty>
                        {section.key === "late" ? "✓ কোনো অর্ডার দেরিতে নেই।" : "আগামী ৩ দিনে ডেলিভারি নেই।"}
                      </Empty>
                    </td>
                  </tr>
                )}
                {section.list.map(({ o, c }) => {
                  const d = daysUntil(o.deliveryDate);
                  return (
                    <tr key={o.id} className="ledger-row align-top">
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="chalk-link num">
                          {o.orderNo}
                        </Link>
                        <div className="mt-1">
                          {o.priority === "urgent" && <UrgentBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.name}
                        <span className="num block text-[12.5px] text-stone">{c.phone.replace("+88", "")}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-3">{(byOrder.get(o.id) ?? []).join(", ")}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className={`px-4 py-3 ${section.key === "late" ? "text-chalk" : ""}`}>
                        <span className="num">{dateShort(o.deliveryDate)}</span>
                        <span className="block text-[12.5px]">
                          {section.key === "late"
                            ? `${Math.abs(d ?? 0)} দিন দেরি`
                            : relativeDay(o.deliveryDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {Number(o.dueAmount) > 0 ? <DueBadge due={o.dueAmount} /> : <span className="text-stone">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <QuickStatus orderId={o.id} current={o.status} due={Number(o.dueAmount)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
