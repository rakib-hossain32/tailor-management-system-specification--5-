import { getPinnedMeasurementSchemas } from "@/server/repositories/measurement-schema";
import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { Sparkles, CheckCircle2, Clock } from "lucide-react";
import { db } from "@/db";
import {
  customers,
  garmentTypes,
  measurementProfiles,
  measurementSets,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  tasks,
  workers,
} from "@/db/schema";
import { StatusBadge, DueBadge, UrgentBadge } from "@/components/StatusBadge";
import { OrderActions } from "@/components/OrderActions";
import { QuickPayment } from "@/components/QuickPayment";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateShort, dateBn, daysUntil, relativeDay, taka } from "@/lib/format";
import { formatMeasurement } from "@/lib/units";
import { isOverdue, statusMeta } from "@/lib/order-status";
import type { MeasurementSchema, StyleSchema } from "@/lib/measurements";
import { autoDistributeTasks, moveTask } from "../../actions";

export const dynamic = "force-dynamic";

const STAGE_BN: Record<string, string> = {
  cutting: "কাটিং",
  stitching: "সেলাই",
  finishing: "ফিনিশিং",
  buttoning: "বোতাম",
  alteration: "সংশোধন",
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const sp = await searchParams;

  const head = await db
    .select({ o: viewFields(orders), c: viewFields(customers) })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (head.length === 0) notFound();
  const { o, c } = head[0];

  const [items, history, pays, profiles, activeWorkers] = await Promise.all([
    db
      .select({ oi: orderItems, g: viewFields(garmentTypes) })
      .from(orderItems)
      .innerJoin(garmentTypes, eq(orderItems.garmentTypeId, garmentTypes.id))
      .where(eq(orderItems.orderId, id)),
    db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, id))
      .orderBy(asc(orderStatusHistory.changedAt)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.receivedAt)),
    db.select().from(measurementProfiles).where(eq(measurementProfiles.customerId, c.id)),
    db.select().from(workers).where(eq(workers.isActive, true)).orderBy(asc(workers.name)),
  ]);

  const itemIds = items.map((i) => i.oi.id);
  const itemTasks = itemIds.length
    ? await db.select().from(tasks).where(inArray(tasks.orderItemId, itemIds)).orderBy(asc(tasks.assignedAt))
    : [];
  const tasksByItem = new Map<string, typeof itemTasks>();
  for (const t of itemTasks) {
    const list = tasksByItem.get(t.orderItemId) ?? [];
    list.push(t);
    tasksByItem.set(t.orderItemId, list);
  }
  const workerById = new Map(activeWorkers.map((w) => [w.id, w]));

  const setIds = items.map((i) => i.oi.measurementSetId).filter(Boolean) as string[];
  const sets = setIds.length
    ? await db.select().from(measurementSets).where(inArray(measurementSets.id, setIds))
    : [];
  const schemaById = await getPinnedMeasurementSchemas(sets);
  const setById = new Map(sets.map((s) => [s.id, s]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const late = isOverdue(o.status, o.deliveryDate);
  const days = daysUntil(o.deliveryDate);
  const meta = statusMeta(o.status);

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="chalk-link inline-block text-[14.5px] text-gold-dark">
        ← অর্ডার তালিকা
      </Link>

      {(sp.ok || sp.error) && (
        <Alert variant={sp.error ? "destructive" : "success"}>
          <AlertDescription>{sp.error ?? sp.ok}</AlertDescription>
        </Alert>
      )}

      <header className="paper-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="num text-[26px] font-semibold sm:text-[30px]">{o.orderNo}</span>
              <StatusBadge status={o.status} size="md" />
              {o.priority === "urgent" && <UrgentBadge />}
              {o.source === "online" && <Badge variant="gold">অনলাইন অনুরোধ</Badge>}
            </div>
            <p className="mt-2 text-[15px] text-ink-3">
              {meta.hintBn} · অর্ডার {dateBn(o.orderDate)} · {o.type === "alteration" ? "অল্টারেশন" : "নতুন অর্ডার"}
            </p>
            <div className="mt-4 flex flex-wrap gap-6">
              <div>
                <div className="smallcaps text-stone">ডেলিভারি</div>
                <div className={`num text-[19px] ${late ? "text-chalk" : ""}`}>{dateShort(o.deliveryDate)}</div>
                <div className={`text-[13.5px] ${late ? "text-chalk" : "text-stone"}`}>
                  {late ? `${Math.abs(days ?? 0)} দিন দেরি` : relativeDay(o.deliveryDate)}
                </div>
              </div>
              {o.trialDate && (
                <div>
                  <div className="smallcaps text-stone">ট্রায়াল</div>
                  <div className="num text-[19px]">{dateShort(o.trialDate)}</div>
                  <div className="text-[13.5px] text-stone">{relativeDay(o.trialDate)}</div>
                </div>
              )}
              <div>
                <div className="smallcaps text-stone">মোট</div>
                <div className="num text-[19px]">{taka(o.total)}</div>
                <div className="text-[13.5px] text-stone">ছাড় {taka(o.discount)}</div>
              </div>
              <div>
                <div className="smallcaps text-stone">বকেয়া</div>
                <div className={`num text-[19px] ${Number(o.dueAmount) > 0 ? "text-chalk" : "text-[#1D6B3F]"}`}>
                  {taka(o.dueAmount)}
                </div>
                <div className="text-[13.5px] text-stone">পরিশোধিত {taka(o.paidAmount)}</div>
              </div>
            </div>
          </div>

          <div className="min-w-[240px] flex-1 sm:max-w-sm">
            <div className="smallcaps mb-1.5 text-stone">কাস্টমার</div>
            <Link
              href={`/admin/customers/${c.id}`}
              className="chalk-link font-display text-[21px] leading-tight"
            >
              {c.name}
            </Link>
            <div className="num mt-1 text-[15px] text-ink-3">{c.phone.replace("+88", "")}</div>
            <div className="mt-1 text-[14px] text-ink-3">{c.address}</div>
            {c.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <Badge key={t} variant="gold">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {o.notes && (
          <p className="mt-5 border-l-2 border-gold bg-gold-light/40 px-4 py-2.5 text-[14.5px]">{o.notes}</p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          {/* items + measurement snapshot + worker assignment */}
          <section className="paper-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-5 py-3.5">
              <div>
                <h2 className="text-xl">পোশাক, মাপ স্ন্যাপশট ও কারিগর বণ্টন</h2>
                <p className="text-[13.5px] text-stone">
                  অর্ডার তৈরির সময়ের মাপ — পরে কাস্টমারের মাপ বদলালেও এটি বদলাবে না।
                </p>
              </div>
              <form action={autoDistributeTasks}>
                <input type="hidden" name="return_path" value={`/admin/orders/${o.id}`} />
                <Button type="submit" variant="gold" size="sm">
                  <Sparkles className="size-3.5" />
                  অবণ্টিত কাজ স্বয়ংক্রিয় বণ্টন করুন
                </Button>
              </form>
            </div>
            <div className="divide-y divide-ink/10">
              {items.map(({ oi, g }) => {
                const set = oi.measurementSetId ? setById.get(oi.measurementSetId) : undefined;
                const profile = oi.profileId ? profileById.get(oi.profileId) : undefined;
                const pinned = set ? schemaById.get(set.garmentSchemaVersionId) : undefined;
                const schema = (pinned?.measurementSchema ?? g.measurementSchema) as unknown as MeasurementSchema;
                const styleSchema = (pinned?.styleSchema ?? g.styleSchema) as unknown as StyleSchema;
                const fields = (schema.groups ?? [])
                  .flatMap((gr) => gr.fields)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                const styles = (oi.styleOverrides ?? {}) as Record<string, string>;
                const ownTasks = tasksByItem.get(oi.id) ?? [];

                return (
                  <article key={oi.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="text-[19px]">
                        {g.nameBn}
                        <span className="num ml-2 text-[15px] text-stone">
                          × {oi.quantity} · {taka(oi.unitPrice)}
                        </span>
                      </h3>
                      <div className="text-[13.5px] text-ink-3">
                        {profile && <span className="mr-3">মাপ: {profile.displayName}</span>}
                        <span>
                          কাপড়: {oi.fabricSource === "customer" ? "কাস্টমারের নিজের" : "দোকানের স্টক"}
                          {Number(oi.fabricQty) > 0 && (
                            <span className="num"> · {Number(oi.fabricQty)} গজ</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {set ? (
                      <>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge>মাপ v{set.version}</Badge>
                          <span className="text-[13px] text-stone">
                            {set.source === "fit_adjusted"
                              ? "ফিট-কারেকশন"
                              : set.source === "reused"
                                ? "পুরনো মাপ ব্যবহৃত"
                                : set.source === "from_garment"
                                  ? "রেফারেন্স পোশাক থেকে"
                                  : "দোকানে মাপা"}
                            {set.verified ? " · ✓ যাচাইকৃত" : " · অযাচাইকৃত"}
                          </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                          {fields.map((f) => (
                            <div
                              key={f.key}
                              className="flex items-baseline justify-between gap-2 border-b border-dashed border-stone/40 py-1"
                            >
                              <dt className="text-[13.5px] text-ink-3">{f.label_bn}</dt>
                              <dd className="num text-[15px] font-medium">
                                {formatMeasurement((set.values as Record<string, number>)?.[f.key], "inch")}
                                <span className="ml-0.5 text-[11px] text-stone">″</span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {set.changeNote && (
                          <p className="mt-2 text-[13.5px] text-chalk">নোট: {set.changeNote}</p>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 text-[14px] text-stone">মাপ সংযুক্ত নেই।</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(styles)
                        .filter(([, v]) => v && v !== "none")
                        .map(([k, v]) => {
                          const opt = styleSchema.options.find((so) => so.key === k);
                          const label = opt?.choices?.find((ch) => ch.value.trim() === v)?.label_bn ?? v;
                          return (
                            <Badge key={k} variant="outline">
                              {opt?.label_bn}: {label}
                            </Badge>
                          );
                        })}
                    </div>
                    {oi.designNotes && <p className="mt-2 text-[14px] text-ink-3">নোট: {oi.designNotes}</p>}

                    {/* Worker Tasks for this Item */}
                    <div className="mt-4 rounded-md border border-ink/12 bg-paper/60 p-3.5">
                      <div className="smallcaps mb-2 text-stone">কারিগর কাজ বণ্টন (কাটিং · সেলাই · ফিনিশিং)</div>
                      {ownTasks.length === 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-ink-3">
                          <span>এই আইটেমে এখনো টাস্ক তৈরি হয়নি।</span>
                          <form action={autoDistributeTasks}>
                            <input type="hidden" name="return_path" value={`/admin/orders/${o.id}`} />
                            <Button type="submit" size="sm" variant="gold">
                              <Sparkles className="size-3.5" /> টাস্ক তৈরি ও স্বয়ংক্রিয় বণ্টন করুন
                            </Button>
                          </form>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {ownTasks.map((t) => {
                            const w = t.workerId ? workerById.get(t.workerId) : undefined;
                            const roleWorkers = activeWorkers.filter((aw) => aw.role === t.stage);
                            const candidates = roleWorkers.length > 0 ? roleWorkers : activeWorkers;
                            return (
                              <div
                                key={t.id}
                                className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-ink/10 pb-2 last:border-b-0 last:pb-0"
                              >
                                <div className="flex items-center gap-2 text-[14px]">
                                  <Badge variant="outline">{STAGE_BN[t.stage] ?? t.stage}</Badge>
                                  {w ? (
                                    <span className="inline-flex items-center gap-1 font-medium text-ink">
                                      <CheckCircle2 className="size-3.5 text-[#1D6B3F]" />
                                      {w.name}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-stone">
                                      <Clock className="size-3.5" /> বণ্টন ছাড়া
                                    </span>
                                  )}
                                  <span className="num text-[12.5px] text-gold-dark">
                                    ৳{Number(t.pieceRate ?? 0)}
                                  </span>
                                </div>

                                <form action={moveTask} className="flex items-center gap-1.5">
                                  <input type="hidden" name="id" value={t.id} />
                                  <input type="hidden" name="action" value="assign" />
                                  <input
                                    type="hidden"
                                    name="return_path"
                                    value={`/admin/orders/${o.id}`}
                                  />
                                  <Select
                                    name="worker_id"
                                    defaultValue={t.workerId ?? "unassigned"}
                                  >
                                    <SelectTrigger className="h-9 w-[175px] text-[13.5px]" aria-label="কারিগর বাছুন">
                                      <SelectValue placeholder="কারিগর বাছুন" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">— বণ্টন ছাড়া রাখুন —</SelectItem>
                                      {candidates.map((cw) => (
                                        <SelectItem key={cw.id} value={cw.id}>
                                          {cw.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button type="submit" size="sm" variant="default" className="h-9">
                                    বণ্টন
                                  </Button>
                                </form>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* status history */}
          <section className="paper-card">
            <div className="border-b border-ink/15 px-5 py-3.5">
              <h2 className="text-xl">স্ট্যাটাস ইতিহাস</h2>
            </div>
            <ol className="px-5 py-4">
              {history.map((h, i) => (
                <li key={h.id} className="relative flex gap-4 pb-4 last:pb-0">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      i === history.length - 1 ? "bg-gold" : "bg-stone/60"
                    }`}
                  />
                  {i < history.length - 1 && (
                    <span aria-hidden className="absolute top-4 bottom-0 left-[4.5px] w-px bg-stone/40" />
                  )}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-2 text-[14.5px]">
                      <span className="font-medium">
                        {statusMeta(h.toStatus).icon} {statusMeta(h.toStatus).labelBn}
                      </span>
                      {h.fromStatus && (
                        <span className="text-[13px] text-stone">
                          ({statusMeta(h.fromStatus).labelBn} →)
                        </span>
                      )}
                      <span className="num ml-auto text-[13px] text-stone">
                        {new Date(h.changedAt).toLocaleString("en-GB", {
                          timeZone: "Asia/Dhaka",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-[13.5px] text-ink-3">
                      {h.changedBy}
                      {h.note ? ` · ${h.note}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* side column */}
        <div className="space-y-6">
          <section className="paper-card p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/orders/${o.id}/invoice`}>⎙ ইনভয়েস / মেমো প্রিন্ট</Link>
              </Button>
            </div>
            <OrderActions orderId={o.id} current={o.status} due={Number(o.dueAmount)} />
          </section>

          <section className="paper-card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xl">পেমেন্ট</h2>
              <DueBadge due={o.dueAmount} size="md" />
            </div>
            <QuickPayment orderId={o.id} due={Number(o.dueAmount)} />
            <ul className="mt-4 divide-y divide-ink/10">
              {pays.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-2 py-2 text-[14px]">
                  <span>
                    <span className="num font-medium">{taka(p.amount)}</span>
                    <span className="block text-[12.5px] text-stone">
                      {p.method === "cash" ? "ক্যাশ" : p.method.toUpperCase()} · {p.receiptNo}
                    </span>
                  </span>
                  <span className="num text-[13px] text-stone">
                    {new Date(p.receivedAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Dhaka",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
              {pays.length === 0 && <li className="py-3 text-[14px] text-stone">কোনো পেমেন্ট নেই।</li>}
            </ul>
          </section>

          <section className="paper-card p-5">
            <h2 className="mb-2 text-xl">দ্রুত তথ্য</h2>
            <dl className="space-y-2 text-[14.5px]">
              <div className="flex justify-between gap-3 border-b border-dashed border-stone/40 pb-1.5">
                <dt className="text-ink-3">উৎস</dt>
                <dd>{o.source === "walk_in" ? "দোকানে সরাসরি" : o.source === "online" ? "ওয়েবসাইট" : o.source}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-dashed border-stone/40 pb-1.5">
                <dt className="text-ink-3">ট্র্যাকিং টোকেন</dt>
                <dd className="num text-[13px]">{o.trackingToken.slice(0, 8)}…</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">সর্বশেষ আপডেট</dt>
                <dd className="num text-[13.5px]">
                  {new Date(o.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
