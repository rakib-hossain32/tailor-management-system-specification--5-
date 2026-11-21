import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments, customers, garmentTypes, orderItems, orders, payments } from "@/db/schema";
import { StatusBadge, DueBadge } from "@/components/StatusBadge";
import { getCustomerSession } from "@/lib/access";
import { dateBn, dateShort, relativeDay, taka } from "@/lib/format";
import { isOverdue, publicProgress, PUBLIC_STEPS } from "@/lib/order-status";

export const dynamic = "force-dynamic";

async function loadCustomerOverview(id: string) {
  const [custRows, orderRows, apptRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, id)).limit(1),
    db
      .select({ o: orders })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt))
      .limit(50),
    db
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, id))
      .orderBy(asc(appointments.startsAt))
      .limit(10),
  ]);
  return { custRows, orderRows, apptRows, now: Date.now() };
}

export default async function AccountHome() {
  const session = await getCustomerSession();
  if (!session) redirect("/login");
  const id = session.customerId;

  const { custRows, orderRows, apptRows, now } = await loadCustomerOverview(id);

  const c = custRows[0];

  const open = orderRows.filter(({ o }) => !["delivered", "cancelled"].includes(o.status));
  const done = orderRows.filter(({ o }) => ["delivered", "cancelled"].includes(o.status));
  const totalDue = open.reduce((s, r) => s + Number(r.o.dueAmount), 0);

  const items = orderRows.length
    ? await db
        .select({ oi: orderItems, g: garmentTypes })
        .from(orderItems)
        .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
        .where(
          inArray(
            orderItems.orderId,
            orderRows.map((r) => r.o.id),
          ),
        )
    : [];
  const byOrder = new Map<string, string[]>();
  for (const it of items) {
    const arr = byOrder.get(it.oi.orderId) ?? [];
    if (!arr.includes(it.g.nameBn)) arr.push(it.g.nameBn);
    byOrder.set(it.oi.orderId, arr);
  }

  const upcoming = apptRows.filter((a) => new Date(a.startsAt).getTime() > now && !["cancelled", "done"].includes(a.status));

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
        {[
          { l: "চলমান অর্ডার", v: String(open.length), sub: open[0] ? byOrder.get(open[0].o.id)?.join(", ") : "কিছু নেই" },
          { l: "বকেয়া", v: taka(totalDue), sub: totalDue > 0 ? "ডেলিভারির আগে পরিশোধ করুন" : "✓ সব পরিশোধিত", alert: totalDue > 0 },
          { l: "মোট অর্ডার", v: String(orderRows.length), sub: `${done.length}টি সম্পন্ন` },
        ].map((k) => (
          <div key={k.l} className="paper-card p-5">
            <div className="smallcaps text-stone">{k.l}</div>
            <div className={`num mt-1.5 text-[27px] font-semibold ${k.alert ? "text-chalk" : ""}`}>{k.v}</div>
            <div className="mt-1 text-[13.5px] text-ink-3">{k.sub}</div>
          </div>
        ))}
      </div>

      <section className="paper-card">
        <div className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
          <h2 className="text-xl">চলমান অর্ডার</h2>
          <Link href="/account/orders" className="chalk-link text-[14.5px] text-gold-dark">
            সব দেখুন →
          </Link>
        </div>
        <ul className="divide-y divide-ink/10">
          {open.length === 0 && <li className="px-5 py-8 text-center text-ink-3">কোনো চলমান অর্ডার নেই।</li>}
          {open.map(({ o }) => {
            const step = publicProgress(o.status);
            const late = isOverdue(o.status, o.deliveryDate);
            return (
              <li key={o.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <Link href={`/account/orders?id=${o.id}`} className="chalk-link num text-[17px] font-medium">
                    {o.orderNo}
                  </Link>
                  <span className="text-[15.5px]">{(byOrder.get(o.id) ?? []).join(", ")}</span>
                  <span className="ml-auto">
                    <StatusBadge status={o.status} size="md" />
                  </span>
                </div>

                <ol className="mt-3 flex gap-1.5">
                  {PUBLIC_STEPS.map((s, i) => (
                    <li key={s} className="flex-1">
                      <div className={`h-2 rounded-full ${i <= step ? "bg-gold" : "bg-ink/12"}`} />
                      <div className={`mt-1.5 text-[12.5px] ${i === step ? "font-semibold" : "text-stone"}`}>{s}</div>
                    </li>
                  ))}
                </ol>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[14.5px]">
                  <span className={late ? "text-chalk" : "text-ink-3"}>
                    ডেলিভারি: <span className="num">{dateBn(o.deliveryDate)}</span>
                    {late && ` · ${Math.abs(Math.round((new Date(o.deliveryDate).getTime() - now) / 86_400_000))} দিন দেরি`}
                  </span>
                  {Number(o.dueAmount) > 0 ? (
                    <DueBadge due={o.dueAmount} size="md" />
                  ) : (
                    <span className="text-[#1D6B3F]">✓ বকেয়া নেই</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="paper-card">
          <div className="border-b border-ink/15 px-5 py-3.5">
            <h2 className="text-xl">পরবর্তী অ্যাপয়েন্টমেন্ট</h2>
          </div>
          <ul className="divide-y divide-ink/10">
            {upcoming.length === 0 && (
              <li className="px-5 py-6 text-center text-ink-3">
                কোনো বুকিং নেই —{" "}
                <Link href="/book" className="chalk-link text-gold-dark">
                  সময় নিন
                </Link>
              </li>
            )}
            {upcoming.slice(0, 4).map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-[15px]">
                <span className="num rounded-sm bg-ink px-2.5 py-1.5 text-paper">
                  {new Date(a.startsAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Dhaka",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="flex-1">{a.purpose}</span>
                <span className="text-[14px] text-stone">{a.status === "confirmed" ? "নিশ্চিত" : "বুকড"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="paper-card">
          <div className="border-b border-ink/15 px-5 py-3.5">
            <h2 className="text-xl">সাম্প্রতিক পেমেন্ট</h2>
          </div>
          <RecentPayments customerId={id} />
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/account/measurements" className="rounded-sm bg-ink px-5 py-3 text-[15.5px] text-paper hover:bg-ink-2">
          আমার মাপ দেখুন
        </Link>
        <Link href="/book" className="rounded-sm border border-ink/30 px-5 py-3 text-[15.5px] hover:bg-ink/5">
          নতুন অ্যাপয়েন্টমেন্ট
        </Link>
        <Link href="/track" className="rounded-sm border border-ink/30 px-5 py-3 text-[15.5px] hover:bg-ink/5">
          অর্ডার ট্র্যাক
        </Link>
      </div>

      {c && (
        <p className="text-[14px] text-stone">
          গোপনীয়তা: এখানে শুধু আপনার নিজের তথ্য দেখানো হয় — {relativeDay(c.updatedAt)} আপডেট হয়েছে।
        </p>
      )}
    </div>
  );
}

async function RecentPayments({ customerId }: { customerId: string }) {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.customerId, customerId))
    .orderBy(desc(payments.receivedAt))
    .limit(8);

  return (
    <ul className="divide-y divide-ink/10">
      {rows.length === 0 && <li className="px-5 py-6 text-center text-ink-3">কোনো পেমেন্ট নেই।</li>}
      {rows.map((p) => (
        <li key={p.id} className="flex items-baseline gap-3 px-5 py-3 text-[15px]">
          <span className="num font-medium">{taka(p.amount)}</span>
          <span className="text-[14px] text-ink-3">
            {p.method === "cash" ? "ক্যাশ" : p.method.toUpperCase()} · {p.receiptNo}
          </span>
          <span className="num ml-auto text-[13.5px] text-stone">{dateShort(p.receivedAt)}</span>
        </li>
      ))}
    </ul>
  );
}
