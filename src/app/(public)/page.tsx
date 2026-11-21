import Link from "next/link";
import Image from "next/image";
import {
  CalendarCheck,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Ruler,
  Scissors,
  CheckCircle2,
  Star,
  PhoneCall,
  ArrowRight,
  Award,
  Clock,
} from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { TrackForm } from "@/components/TrackForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "রহমান টেইলার্স — ঢাকার প্রিমিয়াম বেসপোক টেইলরিং হাউস (প্রতিষ্ঠা ১৯৯৪)",
};

const SIGNATURE_GARMENTS = [
  {
    name: "বেসপোক ফরমাল ও ক্যাজুয়াল শার্ট",
    tag: "জেন্টস সিগনেচার",
    price: 950,
    days: "৪ দিন",
    fabric: "২.২৫ গজ",
    desc: "ম্যান্ডারিন, কাটওয়ে বা বাটন-ডাউন কলার; ১০টি নিখুঁত শারীরিক মাপে তৈরি।",
    features: ["কলার ও কাফ কাস্টমাইজেশন", "স্লিম বা রেগুলার ফিট", "প্রিমিয়াম ইন্টারলাইনিং"],
  },
  {
    name: "রাজকীয় পাঞ্জাবি ও কুর্তা",
    tag: "উৎসব ও ঈদ স্পেশাল",
    price: 1850,
    days: "৭ দিন",
    fabric: "২.৫০ গজ",
    desc: "ইন্ডিগো সুতি, রাজশাহী সিল্ক বা খাদি কাপড়ে নিখুঁত কাঁধ ও ঘেরের ব্যালেন্স।",
    features: ["ব্যান্ড ও ক্লাসিক কলার", "হাতের সূক্ষ্ম এমব্রয়ডারি", "ম্যাচিং পায়জামা অপশন"],
  },
  {
    name: "ফরমাল ট্রাউজার ও প্যান্ট",
    tag: "কর্পোরেট ফিট",
    price: 1250,
    days: "৬ দিন",
    fabric: "১.৭৫ গজ",
    desc: "ক্রচ, থাই ও হাঁটুর আরামদায়ক অনুপাত — সারাদিন পরলেও ভাঁজ বা টান পড়ে না।",
    features: ["সিঙ্গেল/ডাবল প্লিট বা ফ্ল্যাট ফ্রন্ট", "গ্রিপার ওয়েস্টব্যান্ড", "ইতালিয়ান বটম ফোল্ড"],
  },
  {
    name: "বেসপোক স্যুট, ব্লেজার ও শেরওয়ানি",
    tag: "ওয়েডিং ও এক্সিকিউটিভ",
    price: 6500,
    days: "১০ দিন",
    fabric: "৩.৫০ গজ",
    desc: "বিয়ের আসর বা কর্পোরেট বোর্ডরুম — ক্যানভাস কনস্ট্রাকশন ও পার্সোনালাইজড লাইনিং।",
    features: ["কমপক্ষে ২ বার ট্রায়াল ফিটিং", "হ্যান্ড-স্টিচড ল্যাপেল", "কাস্টম মনোগ্রাম সুবিধা"],
  },
  {
    name: "লেডিস কামিজ ও সালোয়ার স্যুট",
    tag: "লেডিস আটেলিয়ার",
    price: 2200,
    days: "৮ দিন",
    fabric: "৩.২৫ গজ",
    desc: "আর্মহোল, গলা ও স্লিটের নিখুঁত ফিনিশিং — ফুল লাইনিং ও কাস্টম নেকলাইন ডিজাইন।",
    features: ["সুইটহার্ট, বোট বা ভি-নেক", "সিল্ক ও কটন লাইনিং", "ফ্রি ফিট অল্টারেশন"],
  },
  {
    name: "ডিজাইনার শাড়ির ব্লাউজ",
    tag: "ব্রাইডাল ও পার্টি",
    price: 850,
    days: "৫ দিন",
    fabric: "১.২৫ গজ",
    desc: "ডার্ট পয়েন্ট ও আন্ডারবাস্টের নিখুঁত হিসেবে তৈরি ব্রাইডাল ও ট্র্যাডিশনাল ব্লাউজ।",
    features: ["প্যাডেড ও নন-প্যাডেড অপশন", "ব্যাক ডিজাইন কাস্টমাইজেশন", "পাইপিং ও ট্যাসেল ফিনিশ"],
  },
];

const CRAFT_PILLARS = [
  {
    icon: Ruler,
    title: "সিনিয়র মাস্টারের হাতে নিখুঁত মাপ",
    desc: "অভিজ্ঞ মাস্টার কেবল ফিতা দিয়ে মাপেন না — আপনার দাঁড়ানোর ভঙ্গি, কাঁধের ঢাল ও চলাফেরার আরাম বুঝে মাপ নির্ধারণ করেন।",
  },
  {
    icon: Sparkles,
    title: "আজীবন ডিজিটাল মাপ সংরক্ষণ",
    desc: "খাতা হারানোর ভয় নেই। আপনার ও পরিবারের সবার মাপ ভার্সনসহ ডিজিটাল ভল্টে সংরক্ষিত থাকে — পরের অর্ডারে এক ক্লিকেই প্রস্তুত।",
  },
  {
    icon: Scissors,
    title: "ট্রায়াল ও পারফেক্ট ফিট গ্যারান্টি",
    desc: "ফিনিশিংয়ের আগে ট্রায়ালের সুবিধা। সামান্যতম পরিবর্তনও নতুন ভার্সন (`fit_adjusted`) হিসেবে সেভ হয় যাতে পরের পোশাকটি হয় আরও নিখুঁত।",
  },
  {
    icon: ShieldCheck,
    title: "স্বচ্ছ হিসাব ও লাইভ ট্র্যাকিং",
    desc: "কাটিং, সেলাই না ফিনিশিং — আপনার পোশাক এখন কোন কারিগরের টেবিলে আছে এবং কবে ডেলিভারি, তা ফোন থেকেই লাইভ দেখুন।",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "গত ১২ বছর ধরে আমার সব কর্পোরেট শার্ট ও ঈদের পাঞ্জাবি রহমান টেইলার্স থেকেই বানাই। সবচেয়ে বড় সুবিধা হলো আমার মাপ ওদের সিস্টেমে সেভ থাকে — কাপড় দিয়ে আসলেই নির্ধারিত দিনে নিখুঁত ফিট পোশাক পেয়ে যাই।",
    author: "তানভীর হাসান",
    role: "সিনিয়র ব্যাংকার, উত্তরা, ঢাকা",
    tag: "নিয়মিত গ্রাহক · ১২ বছর",
  },
  {
    quote:
      "আমার বিয়ের শেরওয়ানি ও পরিবারের ৮ জনের পাঞ্জাবি একসাথে অর্ডার করেছিলাম। প্রত্যেকের আলাদা প্রোফাইলে মাপ নিয়ে নির্ধারিত সময়ের ২ দিন আগেই ওনারা ডেলিভারি দিয়েছেন। সেলাইয়ের ফিনিশিং এক কথায় অনবদ্য।",
    author: "রহিমউদ্দিন আহমেদ",
    role: "ব্যবসায়ী, ধানমন্ডি, ঢাকা",
    tag: "ফ্যামিলি ও ওয়েডিং অর্ডার",
  },
  {
    quote:
      "লেডিস কামিজ ও ব্লাউজের ফিটিং নিয়ে আমি খুবই খুঁতখুঁতে। ওনাদের মাস্টার প্রথম ট্রায়ালেই যে সূক্ষ্ম ফিট-কারেকশন করে দিয়েছেন, এরপর থেকে আমাকে আর দ্বিতীয়বার কোনো অল্টারেশন করাতে হয়নি।",
    author: "সাবরিনা আক্তার",
    role: "স্থপতি, বনানী, ঢাকা",
    tag: "লেডিস বেসপোক ক্লায়েন্ট",
  },
];

const PROCESS_STEPS = [
  {
    step: "০১",
    title: "অ্যাপয়েন্টমেন্ট বা শোরুমে আগমন",
    desc: "অনলাইনে ৩০ মিনিটের স্লট বুক করে আসুন অথবা সরাসরি আমাদের ধানমন্ডি শোরুমে চলে আসুন। কোনো অপেক্ষা করতে হবে না।",
    img: "/images/fabric-stack.jpg",
  },
  {
    step: "০২",
    title: "মাস্টারের পরামর্শ ও ডিজিটাল মাপ",
    desc: "কাপড় ও ডিজাইন নির্বাচনের পর মাস্টার নিখুঁত মাপ নেবেন এবং সাথে সাথে আপনার ডিজিটাল মাপ কার্ডে তা সংরক্ষিত হবে।",
    img: "/images/chalk-tools.jpg",
  },
  {
    step: "০৩",
    title: "কাটিং, সেলাই ও ট্রায়াল ফিটিং",
    desc: "দক্ষ কাটার ও সেলাই কারিগরের হাতে পোশাক তৈরি হয়। প্রয়োজনে ট্রায়াল দিয়ে ফিট ১০০% নিশ্চিত করা হয়।",
    img: "/images/trial-fitting.jpg",
  },
  {
    step: "০৪",
    title: "কোয়ালিটি চেক ও সময়মতো ডেলিভারি",
    desc: "ইস্ত্রি ও ফিনিশিং শেষে ফোনে রেডি SMS যাবে। শোরুমে এসে পোশাক ও প্রিন্টেড ক্যাশ মেমো বুঝে নিন।",
    img: "/images/hanging-garments.jpg",
  },
];

export default function PublicHome() {
  return (
    <PublicPage>
      {/* ==================== 1. BESPOKE HERO — CUTTING TABLE + MEASUREMENT CARD ==================== */}
      <section className="relative overflow-hidden border-b border-gold/30 bg-ink text-paper">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/images/hero-cutting-table.jpg)" }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, rgba(15,26,44,0.97) 0%, rgba(15,26,44,0.9) 45%, rgba(15,26,44,0.62) 78%, rgba(15,26,44,0.45) 100%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gold/40" aria-hidden />

        <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.12fr_0.88fr] lg:py-24">
          {/* ---------- left: copy ---------- */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/45 bg-gold/15 px-4 py-1.5 text-[13px] text-gold">
                <Award className="size-4" />
                ঢাকার আভিজাত্য ও বিশ্বস্ততার প্রতীক — ১৯৯৪ থেকে
              </span>
              <span className="smallcaps hidden text-paper/60 sm:inline">
                ধানমন্ডি ফ্ল্যাগশিপ আটেলিয়ার
              </span>
            </div>

            <h1 className="mt-5 text-[38px] leading-[1.06] text-white sm:text-[56px] lg:text-[66px]">
              মাপ হোক নিখুঁত,
              <br />
              <span className="text-gold">ফিট হোক রাজকীয়।</span>
            </h1>

            <div className="mt-5 flex items-start gap-4">
              <span
                className="mt-2 hidden h-16 w-px shrink-0 bg-gradient-to-b from-gold to-transparent sm:block"
                aria-hidden
              />
              <p className="max-w-xl text-[16.5px] leading-relaxed text-paper/85 sm:text-[18px]">
                তিন দশকের অভিজ্ঞ মাস্টারের হাতের কাজ এবং ডিজিটাল মাপ সংরক্ষণের অনন্য মেলবন্ধন। আপনার
                শারীরিক গঠন ও ভঙ্গি বুঝে নেওয়া মাপ, নিখুঁত কাটিং এবং তিন ধাপের মান নিয়ন্ত্রণ —
                যেকোনো পোশাকে এক ধাপ এগিয়ে।
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="gold" size="lg">
                <Link href="/book">
                  <CalendarCheck className="size-4" />
                  মাপ দিতে অ্যাপয়েন্টমেন্ট নিন
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                <a href="#track">
                  <SearchCheck className="size-4 text-gold" />
                  অর্ডার ট্র্যাক করুন
                </a>
              </Button>
              <Link
                href="/services"
                className="chalk-link px-1 text-[15.5px] text-paper/85 hover:text-white"
              >
                মূল্য তালিকা দেখুন →
              </Link>
            </div>

            <ul className="mt-9 grid max-w-2xl grid-cols-1 gap-3 border-t border-white/15 pt-6 sm:grid-cols-3">
              {[
                ["১০০%", "ফিটিং গ্যারান্টি"],
                ["৭ দিন", "ফ্রি অল্টারেশন"],
                ["৪–৮ দিন", "সময়মতো ডেলিভারি"],
              ].map(([v, l]) => (
                <li key={l} className="flex items-baseline gap-2.5">
                  <span className="num text-[22px] leading-none font-semibold text-gold">{v}</span>
                  <span className="text-[14px] leading-tight text-paper/80">{l}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---------- right: digital measurement card ---------- */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rotate-[-1.2deg] transition-transform duration-500 hover:rotate-0">
              <div className="rounded-xl border-2 border-gold/70 bg-[#FBF6EC] p-1.5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.85)]">
                <div className="rounded-lg border border-ink/15 bg-[#FFFCF6] p-5">
                  <div className="flex items-start justify-between gap-3 border-b-2 border-ink pb-3">
                    <div className="min-w-0">
                      <div className="smallcaps text-stone">ডিজিটাল মাপ কার্ড</div>
                      <div className="mt-1 truncate font-display text-[22px] leading-none text-ink">
                        রহিমউদ্দিন আহমেদ
                      </div>
                      <div className="num mt-1 text-[12.5px] text-stone">
                        প্রোফাইল: নিজে · পাঞ্জাবি
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="num rounded-sm bg-ink px-2 py-1 text-[12px] text-paper">v3</span>
                      <div className="num mt-1.5 text-[11.5px] text-stone">১৯/১১/২০২৬</div>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    {[
                      ["বুক", "42″", "+½"],
                      ["কোমর", "38″", "+1″"],
                      ["কাঁধ", "18″", "—"],
                      ["হাতা", "24½″", "—"],
                      ["গলা", "16″", "+¼"],
                    ].map(([k, v, d]) => (
                      <li
                        key={k}
                        className="flex items-baseline gap-3 border-b border-dashed border-stone/45 pb-1.5"
                      >
                        <span className="w-20 shrink-0 text-[14.5px] text-ink-3">{k}</span>
                        <span className="num flex-1 text-[19px] font-semibold text-ink">{v}</span>
                        <span
                          className={`num text-[13px] ${
                            d === "—" ? "text-stone" : "font-medium text-chalk"
                          }`}
                        >
                          {d}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3.5 flex items-center justify-between gap-3 rounded-md border border-gold/50 bg-gold-light/45 px-3 py-2">
                    <span className="text-[13px] leading-tight text-gold-dark">
                      ট্রায়ালে সংশোধন — নতুন ভার্সন হিসেবে সংরক্ষিত
                    </span>
                    <CheckCircle2 className="size-4 shrink-0 text-[#1D6B3F]" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-stone">
                    <span className="smallcaps">Rahman Tailors · Dhanmondi</span>
                    <span className="num">০১৭১১-০০০০০১</span>
                  </div>
                </div>
              </div>

              <div className="absolute -right-3 -bottom-8 hidden w-40 overflow-hidden rounded-lg border border-gold/50 shadow-2xl sm:block">
                <Image
                  src="/images/hanging-garments.jpg"
                  width={320}
                  height={224}
                  sizes="160px"
                  alt="দোকানে ঝুলন্ত বেসপোক পাঞ্জাবি"
                  className="h-28 w-full object-cover"
                />
              </div>
            </div>

            <div
              className="absolute -left-6 top-4 hidden h-56 w-7 flex-col justify-between rounded-sm border border-gold/50 bg-gold/90 px-1 py-2 text-ink lg:flex"
              aria-hidden
            >
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <span key={i} className="num text-[9px] font-semibold">
                  {i * 10}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* gold tape strip */}
        <div className="relative border-t border-gold/50 bg-gold">
          <dl className="mx-auto grid max-w-[1280px] grid-cols-2 divide-x divide-ink/25 px-4 sm:grid-cols-4 sm:px-6">
            {[
              ["৩২+ বছর", "কারুশিল্পের ঐতিহ্য"],
              ["১২,০০০+", "সংরক্ষিত মাপ"],
              ["১০০%", "৩ ধাপের কোয়ালিটি চেক"],
              ["৫০+", "দৈনিক অর্ডার"],
            ].map(([v, l]) => (
              <div key={l} className="min-w-0 px-3 py-4 break-words sm:px-5">
                <dt className="num text-[18px] leading-none font-semibold text-ink sm:text-[24px]">
                  {v}
                </dt>
                <dd className="mt-1.5 text-[13px] leading-tight text-ink/80">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ==================== 2. LIVE ORDER TRACKING SECTION ==================== */}
      <section id="track" className="mx-auto max-w-[1280px] scroll-mt-20 px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.35fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-light/40 px-3.5 py-1">
              <Clock className="size-3.5 text-gold-dark" />
              <span className="smallcaps text-gold-dark">লাইভ অর্ডার ট্র্যাকিং</span>
            </div>
            <h2 className="mt-3 text-[32px] leading-tight sm:text-[40px]">
              “আমার পোশাকটি কোন পর্যায়ে আছে?”
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-3">
              দোকানে ফোন করার প্রয়োজন নেই। আপনার মোবাইল নম্বর ও মেমোতে থাকা অর্ডার নম্বরটি দিলে এক মুহূর্তেই দেখে নিন আপনার পোশাক এখন কাটিং, সেলাই, ট্রায়াল নাকি ডেলিভারির জন্য প্রস্তুত।
            </p>
            <ul className="mt-5 space-y-2 text-[14.5px] text-ink-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-gold-dark" />
                কোনো লগইন বা পাসওয়ার্ডের প্রয়োজন নেই
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-gold-dark" />
                আপনার ব্যক্তিগত মাপ বা ঠিকানা সম্পূর্ণ গোপন থাকে
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-gold-dark" />
                ডেলিভারি তারিখ ও বকেয়ার পরিমাণ তাৎক্ষণিক দেখুন
              </li>
            </ul>
          </div>

          <TrackForm />
        </div>
      </section>

      {/* ==================== 3. WHY TRUST US (CRAFT PILLARS) ==================== */}
      <section className="border-y border-ink/10 bg-paper-2/65 py-16">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="smallcaps text-gold-dark">কেন রহমান টেইলার্স অনন্য</div>
            <h2 className="mt-2 text-[32px] sm:text-[42px]">
              আভিজাত্য, বিশ্বাস ও নিখুঁত কারুশিল্পের প্রতিশ্রুতি
            </h2>
            <p className="mt-3 text-[16px] text-ink-3">
              একটি সুন্দর পোশাক কেবল কাপড়ের ওপর নির্ভর করে না — নির্ভর করে সঠিক মাপ, নিখুঁত কাটিং এবং অভিজ্ঞ কারিগরের হাতের ওপর।
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CRAFT_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article key={pillar.title} className="luxury-card flex flex-col justify-between p-6">
                  <div>
                    <div className="flex size-12 items-center justify-center rounded-lg bg-ink text-gold shadow-sm">
                      <Icon className="size-6" />
                    </div>
                    <h3 className="mt-4 text-[20px] leading-snug text-ink">{pillar.title}</h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">{pillar.desc}</p>
                  </div>
                  <div className="mt-4 border-t border-ink/10 pt-3">
                    <span className="smallcaps text-[10px] text-gold-dark">Bespoke Standard</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== 4. SIGNATURE GARMENTS & TRANSPARENT PRICING ==================== */}
      <section id="services" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="smallcaps text-gold-dark">সিগনেচার কালেকশন ও মজুরি</div>
            <h2 className="mt-2 text-[32px] sm:text-[42px]">আমাদের বেসপোক সার্ভিস ও মূল্য তালিকা</h2>
            <p className="mt-2 max-w-2xl text-[16px] text-ink-3">
              আপনার নিজের কাপড় নিয়ে আসুন অথবা আমাদের শোরুমের প্রিমিয়াম ফেব্রিক কালেকশন থেকে বেছে নিন। কোনো লুকানো চার্জ নেই।
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/services">
              সম্পূর্ণ মূল্য ও মাপ তালিকা দেখুন
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNATURE_GARMENTS.map((item) => (
            <article key={item.name} className="paper-card flex flex-col justify-between p-6 transition-shadow hover:shadow-lg">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="gold">{item.tag}</Badge>
                  <span className="num text-[13px] text-stone">ডেলিভারি: {item.days}</span>
                </div>
                <h3 className="mt-3 text-[22px] text-ink">{item.name}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">{item.desc}</p>

                <ul className="mt-4 space-y-1.5 border-t border-dashed border-ink/15 pt-3 text-[13.5px] text-ink-2">
                  {item.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-gold" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-ink/10 pt-4">
                <div>
                  <span className="block text-[12px] text-stone">সেলাই মজুরি (শুরু)</span>
                  <span className="num text-[22px] font-semibold text-ink">
                    ৳ {item.price.toLocaleString("en-US")}+
                  </span>
                </div>
                <Button asChild variant="default" size="sm">
                  <Link href="/book">অ্যাপয়েন্টমেন্ট নিন</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ==================== 5. 4-STEP BESPOKE PROCESS ==================== */}
      <section className="border-y border-gold/30 bg-ink py-16 text-paper">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="smallcaps text-gold">কীভাবে কাজ করে</div>
              <h2 className="mt-2 text-[32px] text-white sm:text-[42px]">
                ৪টি সহজ ধাপে আপনার স্বপ্নের পোশাক
              </h2>
            </div>
            <Button
              asChild
              variant="outline"
              className="border-white/25 bg-white/10 text-white hover:bg-white/20"
            >
              <Link href="/how-it-works">বিস্তারিত প্রক্রিয়া ও নীতিমালা →</Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((s) => (
              <div key={s.step} className="overflow-hidden rounded-xl border border-white/15 bg-white/[0.04]">
                <div className="relative h-44 overflow-hidden">
                  <Image
                    src={s.img}
                    width={800}
                    height={600}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    alt={s.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <span className="num absolute top-3 left-3 rounded-md bg-gold px-2.5 py-1 text-[14px] font-semibold text-ink">
                    ধাপ {s.step}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-[19px] text-white">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-paper/75">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 6. CLIENT TESTIMONIALS ==================== */}
      <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="smallcaps text-gold-dark">গ্রাহকদের আস্থা</div>
          <h2 className="mt-2 text-[32px] sm:text-[42px]">আমাদের সম্মানিত গ্রাহকদের অভিজ্ঞতা</h2>
          <p className="mt-2 text-[16px] text-ink-3">
            হাজারো গ্রাহকের দীর্ঘদিনের সন্তুষ্টিই আমাদের কাজের সবচেয়ে বড় স্বীকৃতি।
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <blockquote key={t.author} className="luxury-card flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center gap-1 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">“{t.quote}”</p>
              </div>
              <footer className="mt-6 border-t border-ink/10 pt-4">
                <div className="font-display text-[18px] text-ink">{t.author}</div>
                <div className="text-[13.5px] text-ink-3">{t.role}</div>
                <Badge variant="gold" className="mt-2">
                  {t.tag}
                </Badge>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* ==================== 7. SHOWROOM & APPOINTMENT CTA ==================== */}
      <section className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6">
        <div className="dark-luxury-card overflow-hidden p-8 sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="smallcaps text-gold">আজই চলে আসুন</div>
              <h2 className="mt-2 text-[30px] leading-tight text-white sm:text-[40px]">
                আপনার পরবর্তী পোশাকটির জন্য নিখুঁত মাপ দিতে প্রস্তুত?
              </h2>
              <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-paper/80">
                অনলাইনে ৩০ মিনিটের স্লট বুক করে রাখলে শোরুমে এসে এক মুহূর্তও অপেক্ষা করতে হবে না। আমাদের সিনিয়র মাস্টার আপনার জন্য প্রস্তুত থাকবেন।
              </p>
              <div className="mt-6 flex flex-wrap gap-3.5">
                <Button asChild variant="gold" size="lg">
                  <Link href="/book">
                    <CalendarCheck className="size-4" />
                    অনলাইনে অ্যাপয়েন্টমেন্ট নিন
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  <a href="tel:+8801711000001">
                    <PhoneCall className="size-4 text-gold" />
                    কল করুন: ০১৭১১-০০০০০১
                  </a>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-white/[0.05] p-6 text-[15px]">
              <div className="smallcaps text-gold">ফ্ল্যাগশিপ শোরুম</div>
              <div className="mt-2 font-display text-[22px] text-white">রহমান টেইলার্স</div>
              <dl className="mt-4 space-y-2.5 text-paper/85">
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-paper/60">ঠিকানা</dt>
                  <dd className="text-right">১২/বি, ধানমন্ডি, ঢাকা-১২০৯</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-paper/60">খোলা থাকে</dt>
                  <dd className="text-right">শনি–বৃহস্পতি, সকাল ১০টা – রাত ৯টা</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-paper/60">সাপ্তাহিক ছুটি</dt>
                  <dd className="text-right text-gold">শুক্রবার</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-paper/60">হটলাইন / WhatsApp</dt>
                  <dd className="num text-right font-medium text-gold">০১৭১১-০০০০০১</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
