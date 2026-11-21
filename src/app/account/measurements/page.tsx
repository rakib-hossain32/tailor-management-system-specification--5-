import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  garmentTypes,
  measurementProfiles,
  measurementSets,
} from "@/db/schema";
import { getCustomerSession } from "@/lib/access";
import { dateBn } from "@/lib/format";
import { formatMeasurement, formatDelta } from "@/lib/units";
import { flattenFields, type MeasurementSchema } from "@/lib/measurements";

export const dynamic = "force-dynamic";

const SOURCE_BN: Record<string, string> = {
  in_store: "দোকানে মাপা",
  reused: "পুরনো মাপ ব্যবহৃত",
  fit_adjusted: "ট্রায়ালের পর সংশোধন",
  from_garment: "রেফারেন্স পোশাক থেকে",
  self_reported: "স্ব-মাপ (যাচাই বাকি)",
  remote_assisted: "ভিডিও কলে মাপ",
  standard_size: "স্ট্যান্ডার্ড সাইজ",
};

async function loadCustomerMeasurements(id: string) {
  const [custRows, profileRows, garmentRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, id)).limit(1),
    db.select().from(measurementProfiles).where(eq(measurementProfiles.customerId, id)),
    db.select().from(garmentTypes),
  ]);
  const c = custRows[0];
  const garmentById = new Map(garmentRows.map((g) => [g.id, g]));

  const profileIds = profileRows.map((p) => p.id);
  const sets = profileIds.length
    ? await db
        .select({ s: measurementSets, p: measurementProfiles })
        .from(measurementSets)
        .innerJoin(measurementProfiles, eq(measurementSets.profileId, measurementProfiles.id))
        .where(inArray(measurementSets.profileId, profileIds))
        .orderBy(asc(measurementSets.measuredAt))
    : [];
  return { custRows, profileRows, garmentRows, c, garmentById, sets, now: Date.now() };
}

export default async function AccountMeasurementsPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/login");
  const id = session.customerId;

  const { custRows, profileRows, garmentRows, c, garmentById, sets, now } = await loadCustomerMeasurements(id);

  const staleNote = (date: string) => {
    const months = Math.floor((now - new Date(date).getTime()) / (30 * 86_400_000));
    return months >= 12 ? `${months} মাস পুরনো` : months >= 1 ? `${months} মাস আগে` : "সাম্প্রতিক";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="smallcaps text-stone">রিড-অনলি</div>
          <h2 className="mt-1 text-[30px]">আমার মাপ</h2>
          <p className="mt-1 max-w-2xl text-[15.5px] text-ink-3">
            মাপ দোকানে মাস্টার নেন; এখানে শুধু দেখা যায়। মাপ বদলাতে চাইলে অ্যাপয়েন্টমেন্ট নিন — সংশোধন হলে নতুন
            সংস্করণ তৈরি হয়, পুরনোটি অক্ষত থাকে।
          </p>
        </div>
        <Link href="/account" className="chalk-link text-[15px] text-gold-dark">
          ← ওভারভিউ
        </Link>
      </div>

      {profileRows.map((p) => {
        const own = sets.filter((x) => x.p.id === p.id).reverse();
        return (
          <section key={p.id} className="paper-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-5 py-3.5">
              <div>
                <h3 className="text-[22px]">{p.displayName}</h3>
                <p className="text-[14px] text-stone">
                  {p.relation && p.relation !== "self" ? `${p.relation} · ` : ""}
                  {p.birthDate ? `জন্ম ${dateBn(p.birthDate)}` : "জন্মতারিখ নেই"}
                </p>
              </div>
              <Link
                href="/book"
                className="rounded-sm border border-ink/30 px-4 py-2.5 text-[15px] hover:bg-ink/5"
              >
                মাপ সংশোধনের অনুরোধ
              </Link>
            </div>

            {p.bodyNotes && (
              <p className="border-b border-dashed border-stone/50 px-5 py-3 text-[15px] text-ink-3">
                শারীরিক নোট: {p.bodyNotes}
              </p>
            )}

            <div className="divide-y divide-ink/10">
              {own.length === 0 && (
                <p className="px-5 py-8 text-center text-ink-3">এই প্রোফাইলে এখনো কোনো মাপ নেওয়া হয়নি।</p>
              )}
              {own.map(({ s }) => {
                const g = garmentById.get(s.garmentTypeId);
                const schema = g?.measurementSchema as unknown as MeasurementSchema | undefined;
                const fields = flattenFields(schema);
                const prev = own.find((x) => x.s.garmentTypeId === s.garmentTypeId && x.s.version === s.version - 1);
                return (
                  <article key={s.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h4 className="text-[19px]">{g?.nameBn ?? "পোশাক"}</h4>
                      <span
                        className={`num rounded-sm px-2 py-0.5 text-[13px] ${
                          s.isCurrent ? "bg-ink text-paper" : "border border-ink/25 text-stone"
                        }`}
                      >
                        v{s.version}
                      </span>
                      <span className="text-[14px] text-stone">
                        {dateBn(s.measuredAt)} · {staleNote(s.measuredAt.toISOString())} ·{" "}
                        {SOURCE_BN[s.source] ?? s.source}
                      </span>
                      {s.verified && <span className="text-[14px] text-[#1D6B3F]">✓ যাচাইকৃত</span>}
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                      {fields.map((f) => {
                        const val = (s.values as Record<string, number>)?.[f.key];
                        const before = (prev?.s.values as Record<string, number>)?.[f.key];
                        const changed = before != null && val != null && Math.abs(val - before) > 0.1;
                        return (
                          <div
                            key={f.key}
                            className="flex items-baseline justify-between gap-2 border-b border-dashed border-stone/40 py-0.5"
                          >
                            <dt className="text-[14px] text-ink-3">{f.label_bn}</dt>
                            <dd className={`num text-[15.5px] ${changed ? "text-chalk" : ""}`}>
                              {formatMeasurement(val, "inch")}
                              <span className="ml-0.5 text-[11px] text-stone">″</span>
                              {changed && (
                                <span className="ml-1.5 text-[12px]">{formatDelta(val! - before!, "inch")}</span>
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>

                    {s.changeNote && (
                      <p className="mt-2 text-[14.5px] text-chalk">সংশোধন: {s.changeNote}</p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {profileRows.length === 0 && (
        <div className="paper-card p-10 text-center text-ink-3">কোনো মাপ প্রোফাইল নেই।</div>
      )}

      <p className="text-[14px] text-stone">
        প্রাইভেসি: এই পাতায় শুধু আপনার নিজের অ্যাকাউন্টের মাপ দেখা যায়। {c ? `${c.name} — ` : ""}অন্য কাস্টমারের মাপ
        কখনো দেখা যায় না।
      </p>
    </div>
  );
}
