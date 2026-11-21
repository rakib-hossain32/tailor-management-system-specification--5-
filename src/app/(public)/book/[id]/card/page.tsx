import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { appointments, customers } from "@/db/schema";
import { AppointmentPdfButton } from "@/components/AppointmentPdfButton";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { dateBn, formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "অ্যাপয়েন্টমেন্ট কার্ড" };

function timeLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? "সকাল" : h < 16 ? "দুপুর" : h < 19 ? "বিকাল" : "রাত";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

/**
 * Printable appointment card (public — no login needed).
 * Scanning the QR takes the shop straight to this customer's measurement hub.
 */
export default async function AppointmentCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dl?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const rows = await db
    .select({ a: appointments, c: customers })
    .from(appointments)
    .leftJoin(customers, eq(appointments.customerId, customers.id))
    .where(eq(appointments.id, id))
    .limit(1);
  if (rows.length === 0) notFound();
  const { a, c } = rows[0];

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  // Shop scans this → straight to the customer's measurement / order hub.
  const target = c
    ? `${proto}://${host}/admin/customers/${c.id}?tab=measurements`
    : `${proto}://${host}/book/${a.id}/card`;

  const qr = await QRCode.toDataURL(target, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
    color: { dark: "#142033", light: "#FFFCF6" },
  });

  const start = new Date(a.startsAt);
  const end = new Date(a.endsAt);

  return (
    <div className="mx-auto max-w-[620px] space-y-4">
      {/* screen-only toolbar */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <Link href="/book" className="chalk-link text-[14.5px] text-gold-dark">
          ← নতুন বুকিং
        </Link>
        <span className="smallcaps text-stone">অ্যাপয়েন্টমেন্ট কার্ড</span>
        <span className="ml-auto flex flex-wrap gap-2.5">
          <AppointmentPdfButton
            targetId="appointment-card"
            fileName={`appointment-${a.id.slice(0, 8)}.pdf`}
            autoStart={sp.dl === "1"}
            label="⬇ PDF ডাউনলোড করুন"
          />
          <Button asChild variant="outline">
            <Link href="/track">অর্ডার ট্র্যাক</Link>
          </Button>
        </span>
      </div>

      <p className="no-print rounded-md border border-gold/50 bg-gold-light/45 px-4 py-2.5 text-[14.5px] text-gold-dark">
        এক ক্লিকেই সরাসরি <b>PDF ডাউনলোড</b> হবে (কোনো প্রিভিউ নয়) — নির্দিষ্ট কার্ড-সাইজে
        (প্রস্থ ৯০ মিমি)। দোকানে কার্ডের QR স্ক্যান করলে সরাসরি আপনার মাপ ও অর্ডারের পাতা খুলবে।
      </p>

      <style dangerouslySetInnerHTML={{ __html: `@page { size: 150mm auto; margin: 7mm; }` }} />

      {/* ================= printable card ================= */}
      <article
        id="appointment-card"
        className="print-area mx-auto w-[360px] max-w-full border-2 border-ink bg-[#FFFCF6] p-4"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <header className="flex items-start justify-between gap-3 border-b-2 border-ink pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink text-gold">
              <Logo size={26} />
            </span>
            <div className="min-w-0">
              <div className="font-display text-[22px] leading-none text-ink">
                রহমান টেইলার্স
              </div>
              <div className="smallcaps text-[9.5px] text-gold-dark">
                অ্যাপয়েন্টমেন্ট কার্ড
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span
              className={`rounded-sm px-2 py-1 text-[12px] font-medium ${
                a.status === "cancelled"
                  ? "bg-chalk-light text-chalk"
                  : a.status === "done"
                    ? "bg-[#D9F0E1] text-[#1D6B3F]"
                    : "bg-gold-light text-gold-dark"
              }`}
            >
              {a.status === "confirmed"
                ? "নিশ্চিত"
                : a.status === "booked"
                  ? "বুকড"
                  : a.status === "done"
                    ? "সম্পন্ন"
                    : a.status === "no_show"
                      ? "এসেন"
                      : "বাতিল"}
            </span>
            <div className="num mt-1 text-[11px] text-stone">#{a.id.slice(0, 8).toUpperCase()}</div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 border-b border-ink/25 py-3">
          <div className="min-w-0">
            <div className="smallcaps text-stone">কাস্টমার</div>
            <div className="mt-0.5 truncate text-[19px] leading-tight font-medium">{a.name}</div>
            <div className="num text-[13.5px] text-ink-3">{formatPhone(a.phone)}</div>
          </div>
          <div className="text-right">
            <div className="smallcaps text-stone">উদ্দেশ্য</div>
            <div className="mt-0.5 text-[17px] leading-tight font-medium">{a.purpose}</div>
            <div className="text-[12.5px] text-stone">
              {a.locationType === "home" ? "হোম ভিজিট" : "শোরুমে"}
            </div>
          </div>
        </section>

        <section className="border-b border-ink/25 py-3">
          <div className="smallcaps text-stone">সময়সূচি</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="text-[24px] leading-none font-semibold text-ink">
              {dateBn(a.startsAt)}
            </span>
            <span className="num text-[19px] text-gold-dark">
              {timeLabel(start)} – {timeLabel(end)}
            </span>
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-3">
            নির্ধারিত সময়ের ১০ মিনিট আগে চলে এলে ভালো। প্রতি স্লট ৩০ মিনিট।
          </p>
        </section>

        {a.address && (
          <section className="border-b border-ink/25 py-3 text-[13.5px]">
            <span className="smallcaps text-stone">ঠিকানা</span>
            <p className="mt-1 text-ink-3">{a.address}</p>
          </section>
        )}

        <section className="border-b border-ink/25 py-3 text-[13.5px]">
          <span className="smallcaps text-stone">সঙ্গে আনুন</span>
          <p className="mt-1 text-ink-3">
            পুরনো অর্ডারের ইনভয়েস (থাকলে), পছন্দের ফেব্রিক বা রেফারেন্স পোশাক, এবং ফোন।
            {a.notes && <span className="block mt-1">নোট: {a.notes}</span>}
          </p>
        </section>

        <footer className="mt-1 flex items-end justify-between gap-3 pt-3">
          <div className="min-w-0">
            <div className="smallcaps text-stone">QR স্ক্যান করুন</div>
            <p className="mt-1 break-all text-[10.5px] leading-tight text-ink-3">
              {c
                ? "কার্ডটি দোকানে দেখালে মাস্টার এক স্ক্যানে আপনার মাপ ও অর্ডার খুলে নেবেন।"
                : target}
            </p>
            <p className="mt-1.5 text-[11px] leading-tight text-ink-3">
              কার্ড হারালেও চিন্তা নেই — আপনার মোবাইল নম্বর{" "}
              <span className="num font-medium text-ink">{formatPhone(a.phone)}</span> দিয়ে দোকানের
              অ্যাডমিন প্যানেলে অ্যাপয়েন্টমেন্ট ও অর্ডার খুঁজে নেওয়া যাবে।
            </p>
            <p className="mt-1.5 text-[11px] text-stone">
              হটলাইন ০১৭১১-০০০০০১ · ১২/বি, ধানমন্ডি, ঢাকা
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="অ্যাপয়েন্টমেন্ট QR"
            width={108}
            height={108}
            className="shrink-0 border border-ink/20 bg-white"
            style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
          />
        </footer>
      </article>
    </div>
  );
}
