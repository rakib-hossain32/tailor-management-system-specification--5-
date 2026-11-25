import { getPinnedMeasurementSchemas } from "@/server/repositories/measurement-schema";
import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc as descOrd, eq } from "drizzle-orm";
import * as bwipjs from "bwip-js/node";
import { recordCode, formatRecordCode } from "@/lib/barcode";
import { db } from "@/db";
import {
  customers,
  garmentTypes,
  measurementProfiles,
  measurementSets,
  orderItems,
  orders,
  settings,
} from "@/db/schema";
import { PrintButton } from "@/components/PrintButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateBn, dateShort, formatPhone } from "@/lib/format";
import { formatMeasurement } from "@/lib/units";
import { flattenFields, type MeasurementSchema, type StyleSchema } from "@/lib/measurements";

export const dynamic = "force-dynamic";
export const metadata = { title: "মাপ কার্ড" };

const SOURCE_BN: Record<string, string> = {
  in_store: "দোকানে মাপা",
  reused: "পুরনো মাপ",
  fit_adjusted: "ফিট-কারেকশন",
  from_garment: "পোশাক থেকে",
  self_reported: "স্ব-মাপ (যাচাই বাকি)",
  remote_assisted: "ভিডিও কলে মাপ",
  standard_size: "স্ট্যান্ডার্ড সাইজ",
};

export default async function MeasurementCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;

  const rows = await db
    .select({
      s: viewFields(measurementSets),
      p: viewFields(measurementProfiles),
      c: viewFields(customers),
      g: viewFields(garmentTypes),
    })
    .from(measurementSets)
    .innerJoin(measurementProfiles, eq(measurementSets.profileId, measurementProfiles.id))
    .innerJoin(customers, eq(measurementProfiles.customerId, customers.id))
    .innerJoin(garmentTypes, eq(measurementSets.garmentTypeId, garmentTypes.id))
    .where(eq(measurementSets.id, id))
    .limit(1);

  if (rows.length === 0) notFound();
  const { s, p, c, g } = rows[0];

  const [shopRows, recentOrders] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, "shop")).limit(1),
    db
      .select({ o: viewFields(orders) })
      .from(orders)
      .where(eq(orders.customerId, c.id))
      .orderBy(descOrd(orders.createdAt))
      .limit(6),
  ]);
  const shop = (shopRows[0]?.value ?? {}) as Record<string, string>;

  const pinned = (await getPinnedMeasurementSchemas([s])).get(s.garmentSchemaVersionId)!;
  const schema = pinned.measurementSchema as unknown as MeasurementSchema;
  const styleSchema = pinned.styleSchema as unknown as StyleSchema;
  const fields = flattenFields(schema);
  const styles = (s.styles ?? {}) as Record<string, string>;
  const values = (s.values ?? {}) as Record<string, number>;

  // Barcode → this customer's record. The card prints ONLY a 12-digit
  // number (lib/barcode) — no URL on paper for anyone to photograph.
  // Staff scan it with the in-app barcode scanner and the customer hub
  // opens inside their staff session.
  const custCode = recordCode(c.id);
  const barcodePng = await bwipjs.toBuffer({
    bcid: "code128",
    text: custCode,
    scale: 5,
    height: 10,
    includetext: false,
    backgroundcolor: "FFFFFF",
    barcolor: "000000",
  });
  const barcode = `data:image/png;base64,${barcodePng.toString("base64")}`;

  const orderList = recentOrders.map((r) => r.o);

  return (
    <div className="space-y-4">
      {/* screen-only toolbar */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/customers/${c.id}?tab=measurements`}
          className="chalk-link text-[14.5px] text-gold-dark"
        >
          ← কাস্টমার প্রোফাইল
        </Link>
        <span className="smallcaps text-stone">মাপ কার্ড · প্রিন্ট / PDF</span>
        <span className="ml-auto flex flex-wrap gap-2.5">
          <PrintButton label="🖨 প্রিন্ট / PDF সেভ করুন" />
          <Button asChild variant="outline">
            <Link href={`/admin/customers/${c.id}`}>কাস্টমার প্রোফাইল</Link>
          </Button>
        </span>
      </div>

      <p className="no-print rounded-md border border-gold/50 bg-gold-light/45 px-4 py-2.5 text-[14.5px] text-gold-dark">
        প্রিন্ট ডায়ালগে “Save as PDF” বেছে নিলে কার্ড-আকৃতির PDF হবে (প্রস্থ ১৫০ মিমি, তথ্য বেশি
        হলে উচ্চতা বড় হয়)। বারকোড স্ক্যান করলে দোকানের সিস্টেমে এই মাপের পূর্ণ রেকর্ড খুলবে।
      </p>

      <style
        dangerouslySetInnerHTML={{
          __html: `@page { size: 150mm auto; margin: 7mm; }`,
        }}
      />

      {/* ================= printable card ================= */}
      <article
        className="print-area mx-auto w-full max-w-[560px] border-2 border-ink bg-[#FFFCF6] p-5 shadow-sm"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        {/* header */}
        <header className="flex items-start justify-between gap-3 border-b-2 border-ink pb-3">
          <div className="min-w-0">
            <div className="smallcaps text-stone">Measurement Card · মাপ কার্ড</div>
            <h1 className="mt-0.5 font-display text-[26px] leading-none text-ink">
              {shop.name_bn ?? "রহমান টেইলার্স"}
            </h1>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-3">
              {shop.address}
              <br />
              <span className="num">ফোন: {shop.phone}</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <Badge className="num">v{s.version}</Badge>
            <div className="num mt-1.5 text-[12px] text-stone">{dateShort(s.measuredAt)}</div>
            <div className="num text-[11px] text-stone">
              {s.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </header>

        {/* customer + garment */}
        <section className="grid grid-cols-2 gap-3 border-b border-ink/25 py-3 text-[13.5px]">
          <div>
            <div className="smallcaps text-stone">কাস্টমার</div>
            <div className="mt-0.5 text-[19px] leading-tight font-medium">{c.name}</div>
            <div className="num text-ink-3">{formatPhone(c.phone)}</div>
            {c.address && <div className="text-[12.5px] text-ink-3">{c.address}</div>}
          </div>
          <div className="text-right">
            <div className="smallcaps text-stone">প্রোফাইল ও পোশাক</div>
            <div className="mt-0.5 text-[17px] leading-tight font-medium">{p.displayName}</div>
            <div className="text-ink-3">{g.nameBn}</div>
            <div className="text-[12.5px] text-stone">
              {SOURCE_BN[s.source] ?? s.source}
              {s.verified ? " · ✓ যাচাইকৃত" : " · যাচাই বাকি"}
            </div>
          </div>
        </section>

        {/* measurements */}
        <section className="py-3">
          <div className="smallcaps mb-2 text-stone">মাপ (ইঞ্চি)</div>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-1.5">
            {fields.map((f) => {
              const v = values[f.key];
              return (
                <div
                  key={f.key}
                  className="flex items-baseline justify-between gap-1.5 border-b border-dashed border-stone/50 pb-1"
                >
                  <dt className="text-[12.5px] text-ink-3">{f.label_bn}</dt>
                  <dd className="num text-[15px] font-semibold">
                    {formatMeasurement(v, "inch")}
                    <span className="text-[10px] text-stone">″</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        {/* styles + notes */}
        <section className="border-t border-ink/25 py-3 text-[13px]">
          <div className="smallcaps mb-1.5 text-stone">স্টাইল / ডিজাইন</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(styles)
              .filter(([, v]) => v && v !== "none")
              .map(([k, v]) => {
                const opt = styleSchema.options.find((o) => o.key === k);
                const label =
                  opt?.choices?.find((ch) => ch.value.trim() === v)?.label_bn ?? v;
                return (
                  <span
                    key={k}
                    className="rounded-sm border border-ink/25 px-2 py-0.5 text-[12.5px]"
                  >
                    {opt?.label_bn}: {label}
                  </span>
                );
              })}
            {Object.keys(styles).filter((k) => styles[k] && styles[k] !== "none").length === 0 && (
              <span className="text-stone">—</span>
            )}
          </div>
          {(s.notes || s.changeNote) && (
            <p className="mt-2 text-[12.5px] text-ink-3">
              {s.changeNote && <span className="text-chalk">সংশোধন: {s.changeNote} </span>}
              {s.notes && <span>নোট: {s.notes}</span>}
            </p>
          )}
        </section>

        {/* recent orders — what the customer ordered before */}
        <section className="border-t border-ink/25 py-3 text-[13px]">
          <div className="smallcaps mb-1.5 text-stone">সাম্প্রতিক অর্ডার</div>
          {orderList.length === 0 ? (
            <span className="text-stone">—</span>
          ) : (
            <ul className="space-y-1">
              {orderList.map((o) => (
                <li key={o.id} className="flex justify-between gap-2 border-b border-dotted border-stone/40 pb-0.5">
                  <span className="code">{o.orderNo}</span>
                  <span className="text-ink-3">{dateShort(o.orderDate)}</span>
                  <span className="num">৳{Number(o.total).toLocaleString("en-US")}</span>
                  <span className="text-[12px] text-stone">{o.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Barcode + footer */}
        <footer className="mt-1 flex items-end justify-between gap-3 border-t-2 border-ink pt-3">
          <div className="min-w-0">
            <div className="smallcaps text-stone">বারকোড স্ক্যান করে রেকর্ড খুলুন</div>
            <p className="code mt-1 text-[12px] leading-tight text-ink-3">{formatRecordCode(custCode)}</p>
            <p className="mt-2 text-[11.5px] text-stone">
              মাস্টারের স্বাক্ষর: ________________ · তারিখ: {dateBn(s.measuredAt)}
            </p>
            <p className="mt-1 text-[10.5px] text-stone">
              এই কার্ডের মাপ অপরিবর্তনীয় — সংশোধন হলে নতুন ভার্সন তৈরি হয়।
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={barcode}
            alt="মাপ কার্ড বারকোড"
            width={190}
            height={54}
            className="shrink-0 bg-white"
            style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
          />
        </footer>
      </article>
    </div>
  );
}
