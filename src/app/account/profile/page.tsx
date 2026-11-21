import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, measurementProfiles, orders } from "@/db/schema";
import { getCustomerSession } from "@/lib/access";
import { dateBn, formatPhone, taka } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const session = await getCustomerSession();
  if (!session) redirect("/login");
  const id = session.customerId;

  const [custRows, profileRows, orderRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, id)).limit(1),
    db.select().from(measurementProfiles).where(eq(measurementProfiles.customerId, id)).orderBy(asc(measurementProfiles.displayName)),
    db
      .select({ total: orders.total, status: orders.status, dueAmount: orders.dueAmount })
      .from(orders)
      .where(eq(orders.customerId, id)),
  ]);
  const c = custRows[0];
  if (!c) return null;

  const openDue = orderRows
    .filter((o) => !["delivered", "cancelled"].includes(o.status))
    .reduce((s, o) => s + Number(o.dueAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="smallcaps text-stone">অ্যাকাউন্ট</div>
          <h2 className="mt-1 text-[30px]">প্রোফাইল</h2>
        </div>
        <Link href="/account" className="chalk-link text-[15px] text-gold-dark">
          ← ওভারভিউ
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="paper-card p-5 sm:p-6">
          <h3 className="text-[24px]">{c.name}</h3>
          <dl className="mt-4 space-y-2.5 text-[16px]">
            {[
              ["ফোন", formatPhone(c.phone)],
              ["বিকল্প ফোন", c.altPhone ?? "—"],
              ["ইমেইল", c.email ?? "—"],
              ["ঠিকানা", c.address ?? "—"],
              ["জন্মতারিখ", c.birthDate ? dateBn(c.birthDate) : "—"],
              ["মোট অর্ডার", String(orderRows.length)],
              ["বর্তমান বকেয়া", taka(openDue)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-dashed border-stone/50 pb-1.5">
                <dt className="text-ink-3">{k}</dt>
                <dd className={k === "ফোন" ? "num" : ""}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {c.tags.map((t) => (
              <span key={t} className="rounded-full bg-gold-light px-3 py-1 text-[14px] text-gold-dark">
                {t}
              </span>
            ))}
            {c.tags.length === 0 && <span className="text-[14.5px] text-stone">কোনো ট্যাগ নেই</span>}
          </div>

          {c.notes && (
            <p className="mt-4 border-l-2 border-gold pl-4 text-[15.5px] text-ink-2">দোকানের নোট: {c.notes}</p>
          )}
        </section>

        <div className="space-y-5">
          <section className="paper-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px]">মাপ প্রোফাইল</h3>
              <span className="num text-[15px] text-stone">{profileRows.length}টি</span>
            </div>
            <ul className="mt-3 space-y-2.5">
              {profileRows.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-dashed border-stone/50 pb-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-light font-semibold text-gold-dark">
                    {p.displayName.charAt(0)}
                  </span>
                  <span className="flex-1">
                    {p.displayName}
                    <span className="block text-[13px] text-stone">
                      {p.relation && p.relation !== "self" ? p.relation : "স্বয়ং"}
                    </span>
                  </span>
                  {p.isDefault && <span className="smallcaps text-[9px] text-gold-dark">ডিফল্ট</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[14px] text-stone">
              পারিবারিক প্রোফাইল (সন্তান/পত্নী/পিতা) যোগ করতে দোকানে জানান — একই অ্যাকাউন্টে থাকবে।
            </p>
            <Link href="/account/measurements" className="chalk-link mt-3 inline-block text-[15px] text-gold-dark">
              মাপগুলো দেখুন →
            </Link>
          </section>

          <section className="paper-card p-5">
            <h3 className="text-[20px]">সম্মতি ও গোপনীয়তা</h3>
            <ul className="mt-3 space-y-2 text-[15px] text-ink-3">
              <li>• লেনদেনের SMS: চালু (অর্ডার/ট্রায়াল/রেডি)</li>
              <li>• মার্কেটিং SMS: {c.smsOptIn ? "সম্মতি আছে" : "বন্ধ"} — পরিবর্তন দোকানে জানান</li>
              <li>• আপনার মাপ কোনো তৃতীয় পক্ষের কাছে যায় না</li>
              <li>• অ্যাকাউন্ট মুছে ফেলার অনুরোধ: ০১৭১১-০০০০০১</li>
            </ul>
            <Link href="/privacy" className="chalk-link mt-3 inline-block text-[15px] text-gold-dark">
              গোপনীয়তা নীতি →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
