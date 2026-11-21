import Link from "next/link";
import { PublicPage, SectionHead } from "@/components/public/PublicPage";

export const metadata = { title: "যোগাযোগ" };

const HOURS = [
  ["শনিবার – বৃহস্পতিবার", "সকাল ১০:০০ – রাত ৯:০০"],
  ["শুক্রবার", "ছুটি"],
  ["ঈদের দিন", "সকাল ১০:০০ – দুপুর ২:০০"],
];

const CHANELS = [
  { t: "ফোন", v: "০১৭১১-০০০০০১", href: "tel:+8801711000001", note: "সবচেয়ে দ্রুত — অ্যাপয়েন্টমেন্ট ও অর্ডার জানতে" },
  { t: "WhatsApp", v: "০১৭১১-০০০০০১", href: "https://wa.me/8801711000001", note: "ছবি পাঠানো ও দ্রুত উত্তর" },
  { t: "ইমেইল", v: "order@rahimantailors.com", href: "mailto:order@rahimantailors.com", note: "কর্পোরেট ও বাল্ক অর্ডার" },
  { t: "ফেসবুক", v: "m.me/rahimantailors", href: "https://m.me/rahimantailors", note: "নতুন সংগ্রহ ও অফার" },
];

export default function ContactPage() {
  return (
    <PublicPage>
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
        <SectionHead
          eyebrow="যোগাযোগ"
          title="দোকানে আসুন বা এখনই কল করুন"
          sub="মাপ দিতে আসার আগে সময় নিলে অপেক্ষা করতে হয় না — অ্যাপয়েন্টমেন্ট নিন।"
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="paper-card p-6 sm:p-7">
            <h2 className="text-[26px]">দোকান</h2>
            <address className="mt-3 not-italic text-[16.5px] leading-relaxed text-ink-2">
              রহমান টেইলার্স
              <br />
              ১২/বি, ধানমন্ডি, ঢাকা-১২০৯
              <br />
              বাংলাদেশ
            </address>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <a href="tel:+8801711000001" className="rounded-sm bg-ink px-5 py-3 text-[15.5px] text-paper hover:bg-ink-2">
                ☏ ০১৭১১-০০০০০১
              </a>
              <a
                href="https://wa.me/8801711000001"
                className="rounded-sm border border-ink/30 px-5 py-3 text-[15.5px] hover:bg-ink/5"
              >
                WhatsApp
              </a>
              <Link href="/book" className="rounded-sm bg-gold px-5 py-3 text-[15.5px] font-medium text-ink hover:bg-gold-light">
                অ্যাপয়েন্টমেন্ট
              </Link>
            </div>

            <div className="mt-6 border-t border-ink/15 pt-4">
              <h3 className="text-[19px]">কর্মঘণ্টা</h3>
              <dl className="mt-2.5 space-y-2 text-[15.5px]">
                {HOURS.map(([d, t]) => (
                  <div key={d} className="flex justify-between gap-4 border-b border-dashed border-stone/50 pb-1.5">
                    <dt className="text-ink-3">{d}</dt>
                    <dd className="num">{t}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* stylised map block — no external embed */}
            <div className="mt-6 overflow-hidden border border-envelope">
              <div
                className="relative h-[220px]"
                style={{
                  background:
                    "linear-gradient(135deg,#E7DCC9 0%,#EFE5D6 60%,#E2D6C2 100%)",
                }}
              >
                <svg viewBox="0 0 400 220" className="absolute inset-0 h-full w-full" aria-label="দোকানের অবস্থানের স্কেচ ম্যাপ">
                  <g stroke="#8B8578" strokeWidth="1" opacity="0.6">
                    <path d="M0 60 H400 M0 140 H400 M90 0 V220 M250 0 V220 M330 0 V220" fill="none" />
                  </g>
                  <path d="M0 100 H400" stroke="#142033" strokeWidth="6" opacity="0.25" fill="none" />
                  <path d="M170 0 V220" stroke="#142033" strokeWidth="6" opacity="0.25" fill="none" />
                  <circle cx="170" cy="100" r="9" fill="#B23A2E" />
                  <circle cx="170" cy="100" r="18" fill="none" stroke="#B23A2E" strokeWidth="2" opacity="0.5" />
                  <text x="186" y="94" fontSize="13" fill="#142033" fontFamily="'Hind Siliguri', sans-serif">
                    রহমান টেইলার্স
                  </text>
                  <text x="186" y="112" fontSize="11" fill="#46546C" fontFamily="'Hind Siliguri', sans-serif">
                    ধানমন্ডি ৩২, ঢাকা
                  </text>
                  <text x="16" y="52" fontSize="11" fill="#8B8578" fontFamily="'Hind Siliguri', sans-serif">
                    মিরপুর রোড
                  </text>
                  <text x="262" y="132" fontSize="11" fill="#8B8578" fontFamily="'Hind Siliguri', sans-serif">
                    ধানমন্ডি লেক
                  </text>
                </svg>
              </div>
              <div className="flex items-center justify-between bg-paper px-4 py-2.5 text-[14px]">
                <span className="text-ink-3">নিকটতম ল্যান্ডমার্ক: ধানমন্ডি ৩২ মসজিদ</span>
                <span className="num text-stone">23.7461° N, 90.3742° E</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {CHANELS.map((c) => (
              <a
                key={c.t}
                href={c.href}
                className="paper-card block p-5 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="smallcaps text-stone">{c.t}</span>
                  <span aria-hidden className="text-gold-dark">↗</span>
                </div>
                <div className="mt-1 text-[21px]">{c.v}</div>
                <div className="mt-1 text-[14.5px] text-ink-3">{c.note}</div>
              </a>
            ))}

            <div className="paper-card p-5">
              <h3 className="text-[19px]">দ্রুত তথ্য</h3>
              <ul className="mt-2.5 space-y-2 text-[15px] text-ink-3">
                <li>• অ্যাপয়েন্টমেন্ট স্লট: ৩০ মিনিট করে</li>
                <li>• অ্যাডভান্স: অর্ডারের ন্যূনতম ৫০%</li>
                <li>• অল্টারেশন: ডেলিভারির ৭ দিন পর্যন্ত ফ্রি</li>
                <li>• SMS: অর্ডার, ট্রায়াল ও রেডি হলে</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
