import { getPinnedMeasurementSchemas } from "@/server/repositories/measurement-schema";
import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  garmentTypes,
  measurementProfiles,
  measurementSets,
  orderItems,
  orders,
  payments,
} from "@/db/schema";
import { DueBadge, StatusBadge } from "@/components/StatusBadge";
import { dateShort, formatPhone, taka } from "@/lib/format";
import { formatMeasurement } from "@/lib/units";
import { flattenFields, type MeasurementSchema } from "@/lib/measurements";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "ওভারভিউ" },
  { key: "measurements", label: "মাপ" },
  { key: "orders", label: "অর্ডার" },
  { key: "payments", label: "পেমেন্ট" },
];

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const cRows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (cRows.length === 0) notFound();
  const c = cRows[0];

  const [profiles, custOrders, custPayments] = await Promise.all([
    db.select().from(measurementProfiles).where(eq(measurementProfiles.customerId, id)),
    db
      .select({ o: viewFields(orders) })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt)),
    db.select().from(payments).where(eq(payments.customerId, id)).orderBy(desc(payments.receivedAt)),
  ]);

  const totalDue = custOrders
    .filter((r) => !["delivered", "cancelled"].includes(r.o.status))
    .reduce((s, r) => s + Number(r.o.dueAmount), 0);
  const totalSpent = custPayments.reduce((s, p) => s + Number(p.amount), 0);

  const profileIds = profiles.map((p) => p.id);
  const sets = profileIds.length
    ? await db
        .select()
        .from(measurementSets)
        .where(inArray(measurementSets.profileId, profileIds))
        .orderBy(asc(measurementSets.version))
    : [];
  const garments = await db.select().from(garmentTypes);
  const schemaById = await getPinnedMeasurementSchemas(sets);
  const garmentById = new Map(garments.map((g) => [g.id, g]));

  const orderIds = custOrders.map((r) => r.o.id);
  const items = orderIds.length
    ? await db
        .select({ oi: orderItems, g: viewFields(garmentTypes) })
        .from(orderItems)
        .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
        .where(inArray(orderItems.orderId, orderIds))
    : [];
  const itemsByOrder = new Map<string, string[]>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.oi.orderId) ?? [];
    if (!arr.includes(it.g.nameBn)) arr.push(it.g.nameBn);
    itemsByOrder.set(it.oi.orderId, arr);
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/customers" className="chalk-link inline-block text-[14.5px] text-gold-dark">
        ← কাস্টমার খাতা
      </Link>

      <header className="paper-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="smallcaps text-stone">কাস্টমার প্রোফাইল</div>
            <h1 className="mt-1 text-3xl sm:text-[40px] leading-tight">{c.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[15px] text-ink-3">
              <span className="num">{formatPhone(c.phone)}</span>
              {c.altPhone && <span className="num">{c.altPhone}</span>}
              {c.email && <span>{c.email}</span>}
              <span>{c.address}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <span key={t} className="rounded-full bg-gold-light px-2.5 py-0.5 text-[13px] text-gold-dark">
                  {t}
                </span>
              ))}
            </div>
            {c.notes && <p className="mt-3 max-w-xl border-l-2 border-gold pl-3 text-[14.5px]">{c.notes}</p>}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href={`/admin/customers/${id}/measurements/new`}
              className="rounded-sm bg-ink px-5 py-3 text-[15px] text-paper hover:bg-ink-2"
            >
              + নতুন মাপ নিন
            </Link>
            <Link
              href={`/admin/orders/new?customer=${id}`}
              className="rounded-sm border border-ink/30 px-5 py-3 text-[15px] hover:bg-ink/5"
            >
              + অর্ডার
            </Link>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-ink/15 pt-4 sm:grid-cols-4">
          {[
            { l: "মোট অর্ডার", v: String(custOrders.length) },
            { l: "খোলা বকেয়া", v: taka(totalDue), alert: totalDue > 0 },
            { l: "মোট পরিশোধ", v: taka(totalSpent) },
            { l: "মাপ প্রোফাইল", v: String(profiles.length) },
          ].map((s) => (
            <div key={s.l}>
              <dt className="smallcaps text-stone">{s.l}</dt>
              <dd className={`num mt-1 text-[21px] ${s.alert ? "text-chalk" : ""}`}>{s.v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/customers/${id}?tab=${t.key}`}
            className={`rounded-full border px-4 py-1.5 text-[14.5px] ${
              tab === t.key ? "border-ink bg-ink text-paper" : "border-ink/25 hover:bg-ink/5"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="paper-card">
            <div className="border-b border-ink/15 px-5 py-3.5">
              <h2 className="text-xl">সাম্প্রতিক অর্ডার</h2>
            </div>
            <ul className="divide-y divide-ink/10">
              {custOrders.slice(0, 5).map(({ o }) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3 text-[14.5px]">
                  <Link href={`/admin/orders/${o.id}`} className="chalk-link num">
                    {o.orderNo}
                  </Link>
                  <span className="text-ink-3">{(itemsByOrder.get(o.id) ?? []).join(", ")}</span>
                  <span className="ml-auto">
                    <StatusBadge status={o.status} />
                  </span>
                  <span className="num w-24 text-right">{dateShort(o.deliveryDate)}</span>
                </li>
              ))}
              {custOrders.length === 0 && <li className="px-5 py-6 text-ink-3">কোনো অর্ডার নেই।</li>}
            </ul>
          </section>

          <section className="paper-card">
            <div className="border-b border-ink/15 px-5 py-3.5">
              <h2 className="text-xl">মাপ প্রোফাইল</h2>
              <p className="text-[13.5px] text-stone">একটি অ্যাকাউন্টের নিচে একাধিক ব্যক্তির মাপ রাখা যায়।</p>
            </div>
            <ul className="divide-y divide-ink/10">
              {profiles.map((p) => {
                const own = sets.filter((s) => s.profileId === p.id && s.isCurrent);
                return (
                  <li key={p.id} className="px-5 py-3.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[16px] font-medium">{p.displayName}</span>
                      {p.relation && p.relation !== "self" && (
                        <span className="text-[13px] text-stone">({p.relation})</span>
                      )}
                      {p.isDefault && <span className="smallcaps text-[9px] text-gold-dark">ডিফল্ট</span>}
                      <Link
                        href={`/admin/customers/${id}/measurements/new?profile=${p.id}`}
                        className="chalk-link ml-auto text-[13.5px] text-gold-dark"
                      >
                        মাপ নিন →
                      </Link>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-ink-3">
                      {own.length === 0 && <span>কোনো মাপ নেই</span>}
                      {own.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-2">
                          {garmentById.get(s.garmentTypeId)?.nameBn}{" "}
                          <span className="num text-stone">v{s.version}</span> ·{" "}
                          <span className="num">{dateShort(s.measuredAt)}</span>
                          <Link
                            href={`/admin/measurements/${s.id}/card`}
                            className="chalk-link text-gold-dark"
                          >
                            কার্ড →
                          </Link>
                        </span>
                      ))}
                    </div>
                    {p.bodyNotes && <p className="mt-1 text-[13.5px] text-ink-3">নোট: {p.bodyNotes}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {tab === "measurements" && (
        <div className="space-y-5">
          {profiles.map((p) => {
            const own = sets.filter((s) => s.profileId === p.id);
            return (
              <section key={p.id} className="paper-card">
                <div className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
                  <h2 className="text-xl">{p.displayName} — মাপের ইতিহাস</h2>
                  <Link
                    href={`/admin/customers/${id}/measurements/new?profile=${p.id}`}
                    className="rounded-sm bg-ink px-4 py-2 text-[14px] text-paper hover:bg-ink-2"
                  >
                    নতুন মাপ
                  </Link>
                </div>
                <div className="divide-y divide-ink/10">
                  {own.length === 0 && <p className="px-5 py-6 text-ink-3">এখনো কোনো মাপ নেওয়া হয়নি।</p>}
                  {[...own]
                    .reverse()
                    .filter((s) => s.isCurrent || own.filter((x) => x.garmentTypeId === s.garmentTypeId).length <= 2)
                    .map((s) => {
                      const g = garmentById.get(s.garmentTypeId);
                      const schema = schemaById.get(s.garmentSchemaVersionId)?.measurementSchema as unknown as MeasurementSchema | undefined;
                      const fields = flattenFields(schema).slice(0, 8);
                      const prevForGarment = own.find(
                        (x) => x.garmentTypeId === s.garmentTypeId && x.version === s.version - 1,
                      );
                      return (
                        <article key={s.id} className="px-5 py-4">
                          <div className="flex flex-wrap items-baseline gap-3">
                            <h3 className="text-[18px]">{g?.nameBn ?? "পোশাক"}</h3>
                            <span
                              className={`smallcaps rounded-sm px-2 py-0.5 ${
                                s.isCurrent ? "bg-ink text-paper" : "border border-ink/25 text-stone"
                              }`}
                            >
                              v{s.version} {s.isCurrent && "· সর্বশেষ"}
                            </span>
                            <span className="text-[13.5px] text-stone">
                              {dateShort(s.measuredAt)} ·{" "}
                              {s.source === "fit_adjusted"
                                ? "ফিট-কারেকশন"
                                : s.source === "reused"
                                  ? "পুরনো মাপ"
                                  : s.source === "from_garment"
                                    ? "পোশাক থেকে"
                                    : s.source === "self_reported"
                                      ? "স্ব-মাপ (অযাচাইকৃত)"
                                      : "দোকানে মাপা"}
                              {s.verified ? " · ✓" : " ·"}
                            </span>
                            {s.changeNote && <span className="text-[13.5px] text-chalk">{s.changeNote}</span>}
                          </div>
                          <dl className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                            {fields.map((f) => {
                              const val = (s.values as Record<string, number>)?.[f.key];
                              const old = (prevForGarment?.values as Record<string, number>)?.[f.key];
                              const changed = old != null && val != null && Math.abs(old - val) > 0.1;
                              return (
                                <div
                                  key={f.key}
                                  className="flex items-baseline justify-between gap-2 border-b border-dashed border-stone/40 py-0.5"
                                >
                                  <dt className="text-[13.5px] text-ink-3">{f.label_bn}</dt>
                                  <dd className={`num text-[15px] ${changed ? "text-chalk" : ""}`}>
                                    {formatMeasurement(val, "inch")}
                                    {changed && (
                                      <span className="ml-1 text-[11px] underline">
                                        {val! > old! ? "↑" : "↓"}
                                      </span>
                                    )}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                        </article>
                      );
                    })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {tab === "orders" && (
        <section className="paper-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[14.5px]">
              <thead>
                <tr className="border-b border-ink/25 text-left">
                  {["অর্ডার নং", "পোশাক", "স্ট্যাটাস", "অর্ডার", "ডেলিভারি", "মোট", "বকেয়া"].map((h) => (
                    <th key={h} className="smallcaps px-4 py-2.5 font-medium text-stone">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {custOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-ink-3">
                      কোনো অর্ডার নেই।
                    </td>
                  </tr>
                )}
                {custOrders.map(({ o }) => (
                  <tr key={o.id} className="ledger-row">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="chalk-link num">
                        {o.orderNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-3">{(itemsByOrder.get(o.id) ?? []).join(", ")}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="num px-4 py-3 text-ink-3">{dateShort(o.orderDate)}</td>
                    <td className="num px-4 py-3">{dateShort(o.deliveryDate)}</td>
                    <td className="num px-4 py-3">{Number(o.total).toLocaleString("en-US")}</td>
                    <td className="px-4 py-3">
                      {Number(o.dueAmount) > 0 ? <DueBadge due={o.dueAmount} /> : <span className="text-stone">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "payments" && (
        <section className="paper-card">
          <div className="flex items-center justify-between border-b border-ink/15 px-5 py-3.5">
            <h2 className="text-xl">পেমেন্ট ইতিহাস</h2>
            <span className="num text-[15px]">
              মোট {taka(totalSpent)} {totalDue > 0 && <span className="text-chalk">· বকেয়া {taka(totalDue)}</span>}
            </span>
          </div>
          <ul className="divide-y divide-ink/10">
            {custPayments.length === 0 && <li className="px-5 py-6 text-ink-3">কোনো পেমেন্ট নেই।</li>}
            {custPayments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 text-[14.5px]">
                <span className="num font-medium">{taka(p.amount)}</span>
                <span className="text-ink-3">
                  {p.method === "cash" ? "ক্যাশ" : p.method.toUpperCase()}
                  {p.txnId ? ` · ${p.txnId}` : ""}
                </span>
                <span className="num text-[13.5px] text-stone">{p.receiptNo}</span>
                <span className="ml-auto num text-[13.5px] text-stone">
                  {new Date(p.receivedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
