import { viewFields } from "@/server/repositories/views";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customers, garmentTypes, orderItems, orders, payments } from "@/db/schema";
import { StatusBadge, DueBadge } from "@/components/StatusBadge";
import { getCustomerSession } from "@/lib/access";
import { dateBn, taka } from "@/lib/format";
import { isOverdue, publicProgress, PUBLIC_STEPS } from "@/lib/order-status";
import { formatMeasurement } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const sp = await searchParams;
  const session = await getCustomerSession();
  if (!session) redirect("/login");
  const id = session.customerId;

  const rows = await db
    .select({ o: viewFields(orders) })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  if (rows.length === 0) {
    return (
      <div className="paper-card p-10 text-center">
        <h2 className="text-[24px]">এখনো কোনো অর্ডার নেই</h2>
        <p className="mt-2 text-[15.5px] text-ink-3">
          দোকানে অর্ডার দিলে সবকিছু এখানে দেখা যাবে।{" "}
          <Link href="/book" className="chalk-link text-gold-dark">
            অ্যাপয়েন্টমেন্ট নিন
          </Link>
        </p>
      </div>
    );
  }

  const orderIds = rows.map((r) => r.o.id);
  const [itemRows, payRows] = await Promise.all([
    db
      .select({ oi: orderItems, g: viewFields(garmentTypes) })
      .from(orderItems)
      .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
      .where(inArray(orderItems.orderId, orderIds)),
    db.select().from(payments).where(inArray(payments.orderId, orderIds)).orderBy(desc(payments.receivedAt)),
  ]);

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const it of itemRows) {
    const arr = itemsByOrder.get(it.oi.orderId) ?? [];
    arr.push(it);
    itemsByOrder.set(it.oi.orderId, arr);
  }
  const paysByOrder = new Map<string, typeof payRows>();
  for (const p of payRows) {
    if (!p.orderId) continue;
    const arr = paysByOrder.get(p.orderId) ?? [];
    arr.push(p);
    paysByOrder.set(p.orderId, arr);
  }

  const focus = sp.id ? rows.find((r) => r.o.id === sp.id)?.o : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="smallcaps text-stone">ইতিহাস</div>
          <h2 className="mt-1 text-[30px]">আমার অর্ডার ({rows.length})</h2>
        </div>
        <Link href="/account" className="chalk-link text-[15px] text-gold-dark">
          ← ওভারভিউ
        </Link>
      </div>

      {focus && (
        <section className="paper-card rise border-gold/60 p-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="num text-[24px] font-semibold">{focus.orderNo}</span>
            <StatusBadge status={focus.status} size="md" />
            {focus.priority === "urgent" && (
              <span className="rounded-sm bg-chalk px-2 py-0.5 text-[12px] font-semibold text-paper">জরুরি</span>
            )}
          </div>

          <ol className="mt-4 flex gap-1.5">
            {PUBLIC_STEPS.map((s, i) => (
              <li key={s} className="flex-1">
                <div className={`h-2.5 rounded-full ${i <= publicProgress(focus.status) ? "bg-gold" : "bg-ink/12"}`} />
                <div className={`mt-1.5 text-[13px] ${i === publicProgress(focus.status) ? "font-semibold" : "text-stone"}`}>
                  {s}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="smallcaps mb-2 text-stone">পোশাক</div>
              <ul className="space-y-2.5">
                {(itemsByOrder.get(focus.id) ?? []).map(({ oi, g }) => (
                  <li key={oi.id} className="rounded-sm border border-envelope p-3">
                    <div className="flex justify-between text-[15.5px]">
                      <span className="font-medium">{g.nameBn}</span>
                      <span className="num">×{oi.quantity}</span>
                    </div>
                    <div className="mt-1 text-[13.5px] text-ink-3">
                      কাপড়: {oi.fabricSource === "customer" ? "আপনার নিজের" : "দোকানের"}
                      {Number(oi.fabricQty) > 0 && <span className="num"> · {Number(oi.fabricQty)} গজ</span>}
                    </div>
                    {oi.designNotes && <div className="mt-1 text-[13.5px] text-ink-3">নোট: {oi.designNotes}</div>}
                  </li>
                ))}
                {(itemsByOrder.get(focus.id) ?? []).length === 0 && (
                  <li className="text-[14.5px] text-stone">কোনো আইটেম নেই।</li>
                )}
              </ul>
            </div>

            <div>
              <div className="smallcaps mb-2 text-stone">হিসাব</div>
              <dl className="space-y-1.5 text-[15.5px]">
                <div className="flex justify-between border-b border-dashed border-stone/50 pb-1.5">
                  <dt className="text-ink-3">মোট</dt>
                  <dd className="num">{taka(focus.total)}</dd>
                </div>
                <div className="flex justify-between border-b border-dashed border-stone/50 pb-1.5">
                  <dt className="text-ink-3">পরিশোধিত</dt>
                  <dd className="num">{taka(focus.paidAmount)}</dd>
                </div>
                <div className="flex justify-between text-[18px] font-semibold">
                  <dt>বকেয়া</dt>
                  <dd className={`num ${Number(focus.dueAmount) > 0 ? "text-chalk" : "text-[#1D6B3F]"}`}>
                    {taka(focus.dueAmount)}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 text-[15px]">
                ডেলিভারি:{" "}
                <span className={`num ${isOverdue(focus.status, focus.deliveryDate) ? "text-chalk" : ""}`}>
                  {dateBn(focus.deliveryDate)}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-[14.5px] text-ink-3">
                {(paysByOrder.get(focus.id) ?? []).map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-dashed border-stone/40 pb-1">
                    <span>
                      {p.method === "cash" ? "ক্যাশ" : p.method.toUpperCase()} · {p.receiptNo}
                    </span>
                    <span className="num">{taka(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <ul className="space-y-3">
        {rows.map(({ o }) => {
          const late = isOverdue(o.status, o.deliveryDate);
          const active = !["delivered", "cancelled"].includes(o.status);
          return (
            <li key={o.id} className="paper-card p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="num text-[18px] font-medium">{o.orderNo}</span>
                <StatusBadge status={o.status} />
                <span className="text-[15.5px] text-ink-3">
                  {(itemsByOrder.get(o.id) ?? []).map((i) => `${i.g.nameBn} ×${i.oi.quantity}`).join(", ")}
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-3">
                  {Number(o.dueAmount) > 0 && <DueBadge due={o.dueAmount} />}
                  <span className={`num text-[14.5px] ${late ? "text-chalk" : "text-stone"}`}>
                    {dateBn(o.deliveryDate)}
                  </span>
                  <Link
                    href={`/account/orders?id=${o.id}`}
                    className="rounded-sm border border-ink/25 px-3 py-1.5 text-[14px] hover:bg-ink/5"
                  >
                    বিস্তারিত
                  </Link>
                  {active && (
                    <Link href="/track" className="chalk-link text-[14px] text-gold-dark">
                      ট্র্যাক
                    </Link>
                  )}
                </span>
              </div>
              {o.notes && <p className="mt-2 text-[14.5px] text-ink-3">নোট: {o.notes}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
