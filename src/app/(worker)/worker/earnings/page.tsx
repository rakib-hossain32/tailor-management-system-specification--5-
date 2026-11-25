import { viewFields } from "@/server/repositories/views";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/access";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { garmentTypes, orderItems, orders, tasks, workers } from "@/db/schema";
import { dateShort, isoDate, startOfToday } from "@/lib/format";

export const dynamic = "force-dynamic";

const STAGE_BN: Record<string, string> = {
  cutting: "কাটিং",
  stitching: "সেলাই",
  finishing: "ফিনিশিং",
  buttoning: "বোতাম",
  alteration: "সংশোধন",
};

export default async function WorkerEarnings() {
  const session = await getStaffSession();
  if (!session || session.role !== "worker" || !session.workerId) redirect("/staff-login?next=/worker");
  const [active] = await db.select().from(workers).where(eq(workers.id, session.workerId)).limit(1);

  const monthStart = isoDate(new Date(startOfToday().getFullYear(), startOfToday().getMonth(), 1));

  const [summary, recent] = await Promise.all([
    active
      ? db
          .select({
            total: sql<string>`coalesce(sum(${tasks.pieceRate}),0)`,
            earned: sql<string>`coalesce(sum(${tasks.pieceRate}) filter (where ${tasks.status} = 'qc_passed'),0)`,
            pending: sql<string>`coalesce(sum(${tasks.pieceRate}) filter (where ${tasks.status} in ('assigned','in_progress','rework','done')),0)`,
            monthEarned: sql<string>`coalesce(sum(${tasks.pieceRate}) filter (where ${tasks.status} = 'qc_passed' and ${tasks.completedAt} >= ${monthStart}),0)`,
            passed: sql<number>`count(*) filter (where ${tasks.status} = 'qc_passed')::int`,
            rework: sql<number>`count(*) filter (where ${tasks.status} = 'rework')::int`,
            open: sql<number>`count(*) filter (where ${tasks.status} in ('assigned','in_progress','rework'))::int`,
          })
          .from(tasks)
          .where(eq(tasks.workerId, active.id))
      : Promise.resolve([]),
    active
      ? db
          .select({
            t: viewFields(tasks),
            orderNo: orders.orderNo,
            garment: garmentTypes.nameBn,
            delivery: orders.deliveryDate,
          })
          .from(tasks)
          .innerJoin(orderItems, eq(tasks.orderItemId, orderItems.id))
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
          .where(eq(tasks.workerId, active.id))
          .orderBy(desc(tasks.completedAt))
          .limit(40)
      : Promise.resolve([]),
  ]);

  const s = summary[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="smallcaps text-stone">কারিগর ভিউ</div>
          <h1 className="mt-1 text-[34px] sm:text-[40px]">আমার আয়</h1>
          <p className="mt-1 text-[16px] text-ink-3">{active?.name ?? "—"}</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link href={`/worker?w=${active?.id ?? ""}`} className="rounded-full border border-ink/25 px-4 py-2 text-[15px] hover:bg-ink/5">
            ← আমার কাজ
          </Link>

        </nav>
      </header>

      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { l: "এ মাসে জমা", v: `৳${Math.round(Number(s.monthEarned)).toLocaleString("en-US")}` },
            { l: "মোট জমা", v: `৳${Math.round(Number(s.earned)).toLocaleString("en-US")}` },
            { l: "চলমান কাজ (সম্ভাব্য)", v: `৳${Math.round(Number(s.pending)).toLocaleString("en-US")}` },
            { l: "কাজ সংখ্যা", v: `${s.passed} পাস · ${s.open} বাকি` },
          ].map((k) => (
            <div key={k.l} className="paper-card p-5">
              <div className="smallcaps text-stone">{k.l}</div>
              <div className="num mt-1.5 text-[26px] font-semibold">{k.v}</div>
            </div>
          ))}
        </div>
      )}

      <section className="paper-card overflow-hidden">
        <div className="border-b border-ink/15 px-5 py-3.5">
          <h2 className="text-xl">সাম্প্রতিক কাজ</h2>
          <p className="text-[13.5px] text-stone">
            মজুরি যোগ হয় QC “পাস” হওয়ার পর। হিসাব ভুল মনে হলে ম্যানেজারকে জানান।
          </p>
        </div>
        <ul className="divide-y divide-ink/10">
          {recent.length === 0 && <li className="px-5 py-8 text-center text-ink-3">কোনো কাজ নেই।</li>}
          {recent.map(({ t, orderNo, garment, delivery }) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[16px]">
              <span className="rounded-sm border border-ink/25 px-2.5 py-1 text-[14.5px]">{STAGE_BN[t.stage]}</span>
              <span className="font-medium">{garment}</span>
              <span className="num text-[14.5px] text-stone">{orderNo.slice(-7)}</span>
              <span className="text-[14.5px] text-stone">ডেডলাইন {dateShort(delivery)}</span>
              <span
                className={`ml-auto rounded-full px-3 py-1 text-[14px] ${
                  t.status === "qc_passed"
                    ? "bg-[#D9F0E1] text-[#1D6B3F]"
                    : t.status === "done"
                      ? "bg-[#DCE9F8] text-[#1B4F8F]"
                      : t.status === "rework"
                        ? "bg-chalk-light text-chalk"
                        : "bg-paper-3 text-stone"
                }`}
              >
                {t.status === "qc_passed" ? "✓ পাস" : t.status === "done" ? "যাচাই বাকি" : t.status === "rework" ? "রিওয়ার্ক" : "চলছে/বাকি"}
              </span>
              <span className="num w-20 text-right font-medium">৳{Number(t.pieceRate ?? 0)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[14.5px] text-stone">
        অ্যাডভান্স বা পরিশোধন দরকার হলে মালিকের সঙ্গে কথা বলুন — লেজারে আলাদা এন্ট্রি হিসেবে থাকবে।
      </p>
    </div>
  );
}


