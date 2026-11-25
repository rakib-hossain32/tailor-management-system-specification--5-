import { getPinnedMeasurementSchemas } from "@/server/repositories/measurement-schema";
import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  garmentTypes,
  measurementProfiles,
  measurementSets,
  orderItems,
  orders,
  payments,
  settings,
} from "@/db/schema";
import { PrintButton } from "@/components/PrintButton";
import { dateBn, dateShort, taka } from "@/lib/format";
import { formatMeasurement } from "@/lib/units";
import { statusMeta } from "@/lib/order-status";
import { flattenFields, type MeasurementSchema } from "@/lib/measurements";

export const dynamic = "force-dynamic";

/** Deterministic bar pattern derived from the order number (visual tag). */
function barcodeBars(orderNo: string): number[] {
  const seed = orderNo.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const bars: number[] = [];
  let x = seed;
  for (let i = 0; i < 46; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    bars.push((x % 3) + 1);
  }
  return bars;
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;

  const head = await db
    .select({ o: viewFields(orders), c: viewFields(customers) })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (head.length === 0) notFound();
  const { o, c } = head[0];

  const [items, pays, shopRows, profiles] = await Promise.all([
    db
      .select({ oi: orderItems, g: viewFields(garmentTypes) })
      .from(orderItems)
      .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
      .where(eq(orderItems.orderId, id)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.receivedAt)),
    db.select().from(settings).where(eq(settings.key, "shop")).limit(1),
    db.select().from(measurementProfiles).where(eq(measurementProfiles.customerId, c.id)),
  ]);

  const shop = (shopRows[0]?.value ?? {}) as Record<string, string>;
  const setIds = items.map((i) => i.oi.measurementSetId).filter(Boolean) as string[];
  const sets = setIds.length
    ? await db.select().from(measurementSets).where(inArray(measurementSets.id, setIds))
    : [];
  const schemaById = await getPinnedMeasurementSchemas(sets);
  const setById = new Map(sets.map((s) => [s.id, s]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const bars = barcodeBars(o.orderNo);
  const trackingUrl = `track.tailorpro.app/t/${o.trackingToken.slice(0, 8)}`;

  return (
    <div className="print-surface mx-auto max-w-[860px] space-y-4 py-6">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link href={`/admin/orders/${o.id}`} className="chalk-link text-[14.5px] text-gold-dark">
          ← অর্ডারে ফিরে যান
        </Link>
        <span className="ml-auto" />
        <PrintButton label="ক্যাশ মেমো প্রিন্ট" />
      </div>

      <article className="print-page bg-white p-7 text-ink shadow-[0_10px_30px_-24px_rgba(20,32,51,0.7)] sm:p-10">
        {/* header */}
        <header className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-ink pb-4">
          <div>
            <div className="smallcaps text-stone">ক্যাশ মেমো / ইনভয়েস</div>
            <h1 className="mt-1 text-[34px] leading-none">{shop.name_bn ?? "রহমান টেইলার্স"}</h1>
            <p className="mt-2 text-[14.5px] text-ink-3">
              {shop.address}
              <br />
              <span className="num">ফোন: {shop.phone}</span> · {shop.hours}
            </p>
          </div>

          <div className="text-right">
            <div className="code text-[26px] font-semibold tracking-tight">{o.orderNo}</div>
            <div className="mt-1 text-[14.5px] text-ink-3">
              তারিখ: <span className="num">{dateShort(o.orderDate)}</span>
            </div>
            <div className="text-[14.5px] text-ink-3">
              ডেলিভারি: <span className="num">{dateShort(o.deliveryDate)}</span>
            </div>
            <div className="mt-1 inline-block rounded-sm border border-ink/30 px-2 py-0.5 text-[13.5px]">
              {statusMeta(o.status).labelBn}
            </div>
            {/* visual tag */}
            <div className="mt-3 flex items-end justify-end gap-[2px]" aria-hidden>
              {bars.map((w, i) => (
                <span
                  key={i}
                  className="block h-9"
                  style={{ width: `${w}px`, backgroundColor: i % 2 === 0 ? "#142033" : "transparent" }}
                />
              ))}
            </div>
            <div className="code text-[12px] text-stone">{trackingUrl}</div>
          </div>
        </header>

        {/* customer */}
        <section className="grid grid-cols-2 gap-5 border-b border-ink/20 py-4 text-[15px]">
          <div>
            <div className="smallcaps text-stone">কাস্টমার</div>
            <div className="mt-1 text-[19px]">{c.name}</div>
            <div className="num text-ink-3">{c.phone.replace("+88", "")}</div>
            <div className="text-ink-3">{c.address}</div>
          </div>
          <div className="text-right">
            <div className="smallcaps text-stone">অর্ডারের ধরন</div>
            <div className="mt-1">
              {o.type === "alteration" ? "অল্টারেশন" : o.type === "bulk" ? "গ্রুপ" : "নতুন অর্ডার"}
              {o.priority === "urgent" && " · জরুরি"}
            </div>
            <div className="text-ink-3">
              উৎস: {o.source === "walk_in" ? "দোকানে সরাসরি" : o.source === "online" ? "ওয়েবসাইট" : o.source}
            </div>
            {o.trialDate && (
              <div className="text-ink-3">
                ট্রায়াল: <span className="num">{dateShort(o.trialDate)}</span>
              </div>
            )}
          </div>
        </section>

        {/* items */}
        <section className="py-2">
          <table className="w-full text-[14.5px]">
            <thead>
              <tr className="border-b border-ink text-left">
                {["#", "পোশাক", "মাপ (সংক্ষেপ)", "কাপড়", "পরিমাণ", "একক মূল্য", "মোট"].map((h) => (
                  <th key={h} className="smallcaps py-2 pr-3 font-medium text-stone last:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(({ oi, g }, idx) => {
                const set = oi.measurementSetId ? setById.get(oi.measurementSetId) : undefined;
                const schema = (set ? schemaById.get(set.garmentSchemaVersionId)?.measurementSchema : g.measurementSchema) as unknown as MeasurementSchema;
                const brief = flattenFields(schema).slice(0, 5);
                const profile = oi.profileId ? profileById.get(oi.profileId) : undefined;
                return (
                  <tr key={oi.id} className="border-b border-dashed border-stone/50 align-top">
                    <td className="num py-2.5 pr-3">{idx + 1}</td>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{g.nameBn}</span>
                      {profile && <span className="block text-[13px] text-stone">মাপ: {profile.displayName}</span>}
                      {set && (
                        <span className="block text-[12.5px] text-stone">সংস্করণ v{set.version}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-[13.5px] text-ink-3">
                      {set ? (
                        brief
                          .map((f) => `${f.label_bn} ${formatMeasurement((set.values as Record<string, number>)?.[f.key], "inch")}`)
                          .join(", ")
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-[13.5px] text-ink-3">
                      {oi.fabricSource === "customer" ? "কাস্টমারের" : "দোকানের"}
                      {Number(oi.fabricQty) > 0 && <span className="num"> · {Number(oi.fabricQty)} গজ</span>}
                    </td>
                    <td className="num py-2.5 pr-3">{oi.quantity}</td>
                    <td className="num py-2.5 pr-3">{Number(oi.unitPrice).toLocaleString("en-US")}</td>
                    <td className="num py-2.5 text-right font-medium">
                      {(oi.quantity * Number(oi.unitPrice)).toLocaleString("en-US")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* totals + payments */}
        <section className="grid gap-6 border-t border-ink pt-4 sm:grid-cols-2">
          <div>
            <div className="smallcaps mb-2 text-stone">পেমেন্ট</div>
            <ul className="space-y-1 text-[14.5px]">
              {pays.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 border-b border-dashed border-stone/40 pb-1">
                  <span className="text-ink-3">
                    {p.method === "cash" ? "ক্যাশ" : p.method.toUpperCase()}
                    {p.txnId ? ` · ${p.txnId}` : ""} · {p.receiptNo}
                  </span>
                  <span className="num">{taka(p.amount)}</span>
                </li>
              ))}
              {pays.length === 0 && <li className="text-stone">কোনো পেমেন্ট নেই।</li>}
            </ul>
            <p className="mt-3 text-[13px] text-stone">{shop.invoice_footer}</p>
          </div>

          <dl className="space-y-1.5 text-[15.5px]">
            <div className="flex justify-between">
              <dt className="text-ink-3">উপমোট</dt>
              <dd className="num">{taka(o.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-3">ছাড়</dt>
              <dd className="num">− {taka(o.discount)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink/30 pt-1.5 text-[19px] font-semibold">
              <dt>সর্বমোট</dt>
              <dd className="num">{taka(o.total)}</dd>
            </div>
            <div className="flex justify-between text-[15.5px]">
              <dt className="text-ink-3">পরিশোধিত</dt>
              <dd className="num">{taka(o.paidAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink/30 pt-1.5 text-[21px] font-semibold">
              <dt>বকেয়া</dt>
              <dd className={`num ${Number(o.dueAmount) > 0 ? "text-chalk" : "text-[#1D6B3F]"}`}>
                {taka(o.dueAmount)}
              </dd>
            </div>
          </dl>
        </section>

        {/* signatures */}
        <section className="mt-10 grid grid-cols-2 gap-10 text-[14.5px]">
          <div className="border-t border-ink pt-2">কাস্টমারের স্বাক্ষর</div>
          <div className="border-t border-ink pt-2 text-right">অনুমোদিত স্বাক্ষর</div>
        </section>

        <footer className="mt-6 border-t border-ink/20 pt-3 text-center text-[13.5px] text-ink-3">
          ধন্যবাদ — {shop.name_bn ?? "রহমান টেইলার্স"} · {dateBn(o.orderDate)} · অর্ডার {o.orderNo}
        </footer>
      </article>
    </div>
  );
}
