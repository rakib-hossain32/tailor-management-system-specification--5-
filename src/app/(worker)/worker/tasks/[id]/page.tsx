import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "@/lib/access";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { garmentTypes, measurementProfiles, measurementSets, orderItems, orders, tasks, workers } from "@/db/schema";
import { moveTask } from "@/app/(admin)/admin/actions";
import { dateShort } from "@/lib/format";
import { formatMeasurement } from "@/lib/units";
import { flattenFields, type MeasurementSchema } from "@/lib/measurements";

export const dynamic = "force-dynamic";

const STAGE_BN: Record<string, string> = {
  cutting: "কাটিং",
  stitching: "সেলাই",
  finishing: "ফিনিশিং",
  buttoning: "বোতাম",
  alteration: "সংশোধন",
};

export default async function WorkerTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session || session.role !== "worker" || !session.workerId) redirect("/staff-login?next=/worker");
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();

  const rows = await db
    .select({
      t: tasks,
      orderNo: orders.orderNo,
      delivery: orders.deliveryDate,
      orderStatus: orders.status,
      notes: orders.notes,
      oi: orderItems,
      g: garmentTypes,
      w: workers,
    })
    .from(tasks)
    .innerJoin(orderItems, eq(tasks.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
    .leftJoin(workers, eq(tasks.workerId, workers.id))
    .where(and(eq(tasks.id, id), eq(tasks.workerId, session.workerId)))
    .limit(1);

  if (rows.length === 0) notFound();
  const r = rows[0];

  const set = r.oi.measurementSetId
    ? (await db.select().from(measurementSets).where(eq(measurementSets.id, r.oi.measurementSetId)).limit(1))[0]
    : undefined;
  const profile = r.oi.profileId
    ? (await db.select().from(measurementProfiles).where(eq(measurementProfiles.id, r.oi.profileId)).limit(1))[0]
    : undefined;

  const schema = r.g.measurementSchema as unknown as MeasurementSchema;
  const fields = flattenFields(schema);
  const styles = (r.oi.styleOverrides ?? {}) as Record<string, string>;
  const styleOptions = ((r.g.styleSchema ?? { options: [] }) as { options: { key: string; label_bn: string; choices?: { value: string; label_bn: string }[] }[] }).options;

  const back = `/worker?w=${r.t.workerId ?? ""}`;

  return (
    <div className="space-y-5">
      <Link href={back} className="chalk-link text-[16px] text-gold-dark">
        ← আমার কাজ
      </Link>

      <header className="paper-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="rounded-sm bg-ink px-4 py-2.5 text-[20px] text-paper">
            {STAGE_BN[r.t.stage] ?? r.t.stage}
          </span>
          <h1 className="text-[34px] leading-none">{r.g.nameBn}</h1>
          <span className="num text-[20px] text-ink-3">×{r.oi.quantity}</span>
          <span className="ml-auto text-right">
            <span className="block smallcaps text-stone">ডেডলাইন</span>
            <span className="num text-[22px]">{dateShort(r.delivery)}</span>
          </span>
        </div>
        <p className="mt-3 text-[17px] text-ink-3">
          অর্ডার <span className="num">{r.orderNo}</span>
          {profile && <> · মাপ: {profile.displayName}</>} · {r.w?.name ?? "অনির্ধারিত"}
        </p>
        {r.notes && <p className="mt-2 text-[16px]">নোট: {r.notes}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          {r.t.status === "assigned" || r.t.status === "rework" ? (
            <form action={moveTask}>
              <input type="hidden" name="id" value={r.t.id} />
              <input type="hidden" name="action" value="start" />
              <input type="hidden" name="return_path" value={`/worker/tasks/${r.t.id}`} />
              <button className="rounded-sm bg-ink px-7 py-4 text-[20px] text-paper hover:bg-ink-2">
                শুরু করলাম
              </button>
            </form>
          ) : null}
          {r.t.status === "in_progress" ? (
            <form action={moveTask}>
              <input type="hidden" name="id" value={r.t.id} />
              <input type="hidden" name="action" value="done" />
              <input type="hidden" name="return_path" value={`/worker/tasks/${r.t.id}`} />
              <button className="rounded-sm bg-[#1D6B3F] px-7 py-4 text-[20px] text-paper hover:opacity-90">
                শেষ করলাম
              </button>
            </form>
          ) : null}
          {r.t.status === "done" && (
            <span className="rounded-sm border border-ink/30 px-7 py-4 text-[18px]">যাচাইয়ের অপেক্ষায়</span>
          )}
          {r.t.status === "qc_passed" && (
            <span className="rounded-sm bg-[#D9F0E1] px-7 py-4 text-[18px] text-[#1D6B3F]">✓ সম্পন্ন</span>
          )}
          <span className="num self-center text-[22px] text-gold-dark">৳{Number(r.t.pieceRate ?? 0)}</span>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="paper-card p-5">
          <div className="smallcaps mb-2 text-stone">ডিজাইন ও স্টাইল</div>
          <ul className="space-y-2 text-[17px]">
            {Object.entries(styles)
              .filter(([, v]) => v && v !== "none")
              .map(([k, v]) => {
                const opt = styleOptions.find((o) => o.key === k);
                const label = opt?.choices?.find((ch) => ch.value.trim() === v)?.label_bn ?? v;
                return (
                  <li key={k} className="flex justify-between border-b border-dashed border-stone/50 pb-1.5">
                    <span className="text-ink-3">{opt?.label_bn ?? k}</span>
                    <span className="font-medium">{label}</span>
                  </li>
                );
              })}
            {Object.keys(styles).length === 0 && <li className="text-ink-3">বিশেষ স্টাইল নেই।</li>}
          </ul>

          {r.oi.designNotes && (
            <div className="mt-4 rounded-sm border border-gold/60 bg-gold-light/50 p-4">
              <div className="smallcaps text-gold-dark">বিশেষ নোট</div>
              <p className="mt-1 text-[17px]">{r.oi.designNotes}</p>
            </div>
          )}

          <div className="mt-4 text-[16px] text-ink-3">
            কাপড়: {r.oi.fabricSource === "customer" ? "কাস্টমারের নিজের" : "দোকানের স্টক"}
            {Number(r.oi.fabricQty) > 0 && <span className="num"> · {Number(r.oi.fabricQty)} গজ</span>}
          </div>
        </section>

        <section className="paper-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="smallcaps text-stone">মাপ (বড় হরফে)</div>
            {set && (
              <span className="num rounded-sm bg-ink px-2.5 py-1 text-[14px] text-paper">
                v{set.version} · {dateShort(set.measuredAt)}
              </span>
            )}
          </div>

          {set ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {fields.map((f) => (
                <div
                  key={f.key}
                  className="flex items-baseline justify-between gap-2 border-b border-dashed border-stone/50 pb-1.5"
                >
                  <dt className="text-[17px] text-ink-3">{f.label_bn}</dt>
                  <dd className="num text-[26px] leading-none font-semibold">
                    {formatMeasurement((set.values as Record<string, number>)?.[f.key], "inch")}
                    <span className="ml-1 text-[15px] font-normal text-stone">″</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[17px] text-stone">এই আইটেমে মাপ সংযুক্ত নেই — ম্যানেজারকে জানান।</p>
          )}

          {set?.changeNote && (
            <p className="mt-4 rounded-sm border border-chalk/40 bg-chalk-light p-3 text-[16.5px] text-chalk">
              সংশোধনের নোট: {set.changeNote}
            </p>
          )}
          {set?.notes && (
            <p className="mt-3 text-[16.5px] text-ink-3">মাস্টারের নোট: {set.notes}</p>
          )}
        </section>
      </div>
    </div>
  );
}
