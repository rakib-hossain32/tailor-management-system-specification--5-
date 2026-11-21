import { requireAdminPage } from "@/lib/page-auth";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, orders } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";

export const dynamic = "force-dynamic";

const TEMPLATES = [
  {
    code: "order.confirmed",
    event: "অর্ডার নিশ্চিত",
    to: "কাস্টমার",
    body: "আসসালামু আলাইকুম {নাম}, আপনার অর্ডার {অর্ডার_নং} গৃহীত হয়েছে। ডেলিভারি: {তারিখ}। বকেয়া: {টাকা}৳। — {দোকান}",
    on: true,
  },
  {
    code: "order.trial_ready",
    event: "ট্রায়ালের জন্য ডাক",
    to: "কাস্টমার",
    body: "আপনার পোশাকের ট্রায়ালের জন্য {তারিখ}-এর মধ্যে দোকানে আসুন। — {দোকান}",
    on: true,
  },
  {
    code: "order.ready",
    event: "রেডি",
    to: "কাস্টমার",
    body: "আপনার অর্ডার {অর্ডার_নং} তৈরি। বকেয়া {টাকা}৳। আসার সময়: {সময়}। — {দোকান}",
    on: true,
  },
  {
    code: "payment.due_reminder",
    event: "বকেয়া রিমাইন্ডার",
    to: "কাস্টমার",
    body: "আপনার অর্ডারের বকেয়া {টাকা}৳ পরিশোধ করুন। — {দোকান}",
    on: true,
  },
  {
    code: "appointment.reminder",
    event: "অ্যাপয়েন্টমেন্ট রিমাইন্ডার",
    to: "কাস্টমার",
    body: "আপনার অ্যাপয়েন্টমেন্ট {তারিখ} {সময়}। প্রয়োজনে বাতিল করতে জানান। — {দোকান}",
    on: true,
  },
  {
    code: "order.overdue",
    event: "ওভারডিউ (ইন-অ্যাপ)",
    to: "ম্যানেজার",
    body: "{অর্ডার_নং} ডেলিভারি তারিখ পেরিয়ে গেছে — জরুরি দৃষ্টি দিন।",
    on: true,
  },
  {
    code: "stock.low",
    event: "লো-স্টক (ইন-অ্যাপ)",
    to: "ম্যানেজার",
    body: "{কাপড়} স্টক রিঅর্ডার লেভেলের নিচে নেমেছে।",
    on: true,
  },
  {
    code: "festival.reminder",
    event: "ঈদ অফার (মার্কেটিং)",
    to: "কাস্টমার (opt-in)",
    body: "ঈদের অর্ডারের সময় এসে গেছে — আগে বুকিং করলে সময়মতো পাবেন। বন্ধ করতে STOP লিখুন।",
    on: false,
  },
];

const STATUS_BN: Record<string, { label: string; fg: string; bg: string }> = {
  queued: { label: "কিউতে", fg: "#46546C", bg: "#ECE7DE" },
  sent: { label: "পাঠানো", fg: "#1B4F8F", bg: "#DCE9F8" },
  delivered: { label: "ডেলিভারড", fg: "#1D6B3F", bg: "#D9F0E1" },
  failed: { label: "ব্যর্থ", fg: "#8E2C22", bg: "#F8DEDA" },
};

/** Unicode Bangla SMS: ~70 chars per segment (16-bit). */
function segments(body: string): number {
  return Math.max(1, Math.ceil(body.length / 70));
}

export default async function NotificationsPage() {
  await requireAdminPage();
  const [rows, counts] = await Promise.all([
    db
      .select({ n: notifications, orderNo: orders.orderNo })
      .from(notifications)
      .leftJoin(orders, eq(notifications.relatedOrderId, orders.id))
      .orderBy(desc(notifications.createdAt))
      .limit(100),
    db
      .select({ status: notifications.status, n: sql<number>`count(*)::int` })
      .from(notifications)
      .groupBy(notifications.status),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c.n]));

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="নোটিফিকেশন"
        title="SMS লগ ও টেমপ্লেট"
        sub="সব বার্তা কিউয়ের মাধ্যমে যায়, প্রযোজকের সঙ্গে সংযোগ না থাকলে পুনরায় চেষ্টা করা হয়। বাংলা বার্তা Unicode — অক্ষর সীমা মেনে টেমপ্লেট রাখুন।"
        actions={
          <div className="flex flex-wrap gap-2 text-[14.5px]">
            {(["delivered", "sent", "queued", "failed"] as const).map((s) => (
              <span key={s} className="rounded-sm border border-ink/25 px-3 py-1.5">
                {STATUS_BN[s].label} <b className="num">{countMap[s] ?? 0}</b>
              </span>
            ))}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <section className="paper-card overflow-hidden">
          <div className="border-b border-ink/15 px-5 py-3.5">
            <h2 className="text-xl">সাম্প্রতিক বার্তা</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[14.5px]">
              <thead>
                <tr className="border-b border-ink/25 text-left">
                  {["ইভেন্ট", "প্রাপক", "বার্তা", "স্ট্যাটাস", "সময়"].map((h) => (
                    <th key={h} className="smallcaps px-4 py-2.5 font-medium text-stone">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <Empty>কোনো বার্তা পাঠানো হয়নি।</Empty>
                    </td>
                  </tr>
                )}
                {rows.map(({ n, orderNo }) => {
                  const st = STATUS_BN[n.status] ?? STATUS_BN.queued;
                  return (
                    <tr key={n.id} className="ledger-row align-top">
                      <td className="px-4 py-3">
                        <span className="num text-[13px] text-stone">{n.templateCode}</span>
                        {orderNo && <span className="num block text-[13px]">{orderNo}</span>}
                      </td>
                      <td className="num px-4 py-3 text-ink-3">{n.recipient}</td>
                      <td className="px-4 py-3 text-[14px] text-ink-2">
                        {n.body}
                        <span className="mt-1 block text-[12px] text-stone">
                          {n.body.length} অক্রিষ্ট · {segments(n.body)} সেগমেন্ট
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[13px]"
                          style={{ color: st.fg, backgroundColor: st.bg }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="num px-4 py-3 text-[13px] text-stone">
                        {n.sentAt
                          ? new Date(n.sentAt).toLocaleString("en-GB", {
                              timeZone: "Asia/Dhaka",
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="paper-card">
          <div className="border-b border-ink/15 px-5 py-3.5">
            <h2 className="text-xl">টেমপ্লেট</h2>
            <p className="text-[13.5px] text-stone">
              প্রতিটি ইভেন্ট চালু/বন্ধ করা যায়; {"{চলক}"} নাম দিয়ে বার্তা তৈরি হয়।
            </p>
          </div>
          <ul className="divide-y divide-ink/10">
            {TEMPLATES.map((t) => (
              <li key={t.code} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15.5px] font-medium">{t.event}</span>
                  <span className="rounded-full bg-gold-light px-2 py-0.5 text-[12.5px] text-gold-dark">{t.to}</span>
                  <span
                    className={`ml-auto rounded-sm px-2 py-0.5 text-[12.5px] ${
                      t.on ? "bg-[#D9F0E1] text-[#1D6B3F]" : "bg-paper-3 text-stone"
                    }`}
                  >
                    {t.on ? "চালু" : "বন্ধ"}
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] text-ink-3">{t.body}</p>
                <div className="num mt-1 text-[12px] text-stone">
                  {t.code} · {t.body.length} অক্রিষ্ট · {segments(t.body)} সেগমেন্ট
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-[14px] text-stone">
        প্রযোজক: SSL Wireless / Alpha SMS (গেটওয়ে অ্যাবস্ট্রাকশন — বদলানো সহজ)। মার্কেটিং বার্তা শুধু sms_opt_in =
        true কাস্টমারকে, সঙ্গে “বন্ধ করতে STOP” নির্দেশনা।
      </p>
    </div>
  );
}
