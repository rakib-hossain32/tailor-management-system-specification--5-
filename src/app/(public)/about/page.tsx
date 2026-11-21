import Link from "next/link";
import Image from "next/image";
import { Award, ShieldCheck, Users, Sparkles, CalendarCheck } from "lucide-react";
import { PublicPage, SectionHead } from "@/components/public/PublicPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "আমাদের সম্পর্কে" };

const MILESTONES = [
  {
    year: "১৯৯৪",
    title: "ধানমন্ডিতে যাত্রা শুরু",
    desc: "দুইজন অভিজ্ঞ কারিগর ও একটি কাটিং টেবিল নিয়ে নিখুঁত ফিটিংয়ের অঙ্গীকারে রহমান টেইলার্সের সূচনা।",
  },
  {
    year: "২০০৬",
    title: "জেন্টস ও লেডিস বেসপোক সম্প্রসারণ",
    desc: "বিয়ের শেরওয়ানি, স্যুট এবং লেডিস বেসপোক কামিজ-ব্লাউজের জন্য আলাদা বিশেষজ্ঞ কারিগর দল গঠন।",
  },
  {
    year: "২০১৫",
    title: "আধুনিক কাটিং ও ফিনিশিং ইউনিট",
    desc: "৩ ধাপের মান নিয়ন্ত্রণ (কাটিং, সেলাই ও ফিনিশিং QC) এবং নিজস্ব ফেব্রিক স্টুডিও চালু।",
  },
  {
    year: "২০২৬",
    title: "ডিজিটাল মাপ আর্কাইভ ও লাইভ ট্র্যাকিং",
    desc: "কাগজের খাতার বদলে ইমিউটেবল ডিজিটাল মাপ কার্ড, অনলাইন অ্যাপয়েন্টমেন্ট এবং লাইভ অর্ডার ট্র্যাকিং সংযোজন।",
  },
];

const TEAM = [
  {
    name: "মোঃ সাইফুল ইসলাম",
    role: "প্রতিষ্ঠাতা ও প্রধান মাস্টার",
    exp: "৩২ বছরের অভিজ্ঞতা",
    desc: "বেসপোক স্যুট, শেরওয়ানি ও জটিল শারীরিক গঠনের নিখুঁত প্যাটার্ন কাটিংয়ে বিশেষজ্ঞ।",
  },
  {
    name: "হাবিব মিয়া",
    role: "সিনিয়র মাস্টার (মাপ ও ট্রায়াল)",
    exp: "২২ বছরের অভিজ্ঞতা",
    desc: "গ্রাহকের মাপ গ্রহণ, ফিট-কারেকশন এবং ট্রায়াল যাচাইয়ের প্রধান দায়িত্বে।",
  },
  {
    name: "নাজমুল হক",
    role: "শোরুম ম্যানেজার",
    exp: "১৪ বছরের অভিজ্ঞতা",
    desc: "ডেলিভারি ডেডলাইন, কারিগরদের কাজ বণ্টন ও চূড়ান্ত কোয়ালিটি কন্ট্রোল (QC) পরিচালনা করেন।",
  },
  {
    name: "রুবেল হোসেন",
    role: "কাস্টমার রিলেশন ও রিসেপশন",
    exp: "৯ বছরের অভিজ্ঞতা",
    desc: "গ্রাহক অভ্যর্থনা, ফেব্রিক পরামর্শ, ইনভয়েস এবং অ্যাপয়েন্টমেন্ট সমন্বয় করেন।",
  },
];

export default function AboutPage() {
  return (
    <PublicPage>
      <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6">
        <SectionHead
          eyebrow="আমাদের ঐতিহ্য ও দর্শন"
          title="তিন দশকের নিখুঁত হাতের কাজ, এখন ডিজিটাল বিশ্বস্ততায়"
          sub="রহমান টেইলার্স — ১৯৯৪ সাল থেকে ধানমন্ডি, ঢাকায় কাস্টম টেইলরিংয়ে আভিজাত্য ও আস্থার নাম।"
        />

        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5 text-[16.5px] leading-relaxed text-ink-2">
            <p>
              আমাদের মূল দর্শন অত্যন্ত স্পষ্ট:{" "}
              <strong className="font-semibold text-ink">
                “একটি ভুল মাপ মানে কেবল নষ্ট কাপড় নয়, একজন গ্রাহকের আস্থার ক্ষতি।”
              </strong>{" "}
              তাই প্রযুক্তির এই যুগেও আমরা মাপ নেওয়ার কাজটি কখনো অনুমানের ওপর ছেড়ে দিইনি — শোরুমে আমাদের অভিজ্ঞ মাস্টার সরাসরি আপনার শারীরিক গঠন ও ভঙ্গি দেখে মাপ নেন।
            </p>
            <p>
              তবে পুরনো খাতা-কলমের সীমাবদ্ধতাকে আমরা জয় করেছি আধুনিক প্রযুক্তির মাধ্যমে। আপনার প্রতিটি মাপ এখন ভার্সনসহ আমাদের ডিজিটাল ভল্টে সংরক্ষিত থাকে। ট্রায়ালে যদি আধা ইঞ্চিও পরিবর্তন করা হয়, সেটি নতুন ভার্সন হিসেবে সেভ হয় — যাতে পরের বার আপনি শোরুমে এলে এক ক্লিকেই আপনার ‘পারফেক্ট ফিট’ মাপটি পাওয়া যায়।
            </p>
            <p>
              কাটিং, সেলাই ও ফিনিশিং — প্রতিটি ধাপে আমাদের নিজস্ব দক্ষ কারিগর কাজ করেন এবং ম্যানেজারের কোয়ালিটি চেক (QC) ছাড়া কোনো পোশাক ডেলিভারি র‍্যাকে ওঠে না।
            </p>

            <div className="grid grid-cols-3 gap-4 border-t border-ink/10 pt-5">
              <div>
                <div className="num text-[28px] font-semibold text-gold-dark">১৯৯৪</div>
                <div className="text-[13.5px] text-stone">প্রতিষ্ঠাকাল</div>
              </div>
              <div>
                <div className="num text-[28px] font-semibold text-gold-dark">১২,০০০+</div>
                <div className="text-[13.5px] text-stone">সংরক্ষিত মাপ প্রোফাইল</div>
              </div>
              <div>
                <div className="num text-[28px] font-semibold text-gold-dark">১০০%</div>
                <div className="text-[13.5px] text-stone">ট্রায়াল ও ফিট নিশ্চয়তা</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="gold" size="lg">
                <Link href="/book">
                  <CalendarCheck className="size-4" />
                  অ্যাপয়েন্টমেন্ট বুক করুন
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/gallery">আমাদের কাজের গ্যালারি দেখুন</Link>
              </Button>
            </div>
          </div>

          <div className="luxury-card overflow-hidden p-3">
            <Image
              src="/images/hero-cutting-table.jpg"
              width={1200}
              height={800}
              sizes="(max-width: 1024px) 100vw, 50vw"
              alt="রহমান টেইলার্সের কাটিং টেবিল"
              className="h-[380px] w-full rounded-lg object-cover"
            />
            <div className="p-4">
              <div className="smallcaps text-gold-dark">ধানমন্ডি আটেলিয়ার</div>
              <div className="mt-1 font-display text-[20px] text-ink">
                অভিজ্ঞ হাতের মাপ ও নিখুঁত প্যাটার্ন কাটিং
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="border-y border-ink/10 bg-paper-2/65 py-14">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="smallcaps text-gold-dark">আমাদের পথচলা</div>
          <h2 className="mt-2 text-[30px] sm:text-[38px]">৩২ বছরের ঐতিহ্যের মাইলফলক</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MILESTONES.map((m) => (
              <li key={m.year} className="paper-card p-6">
                <div className="num text-[28px] font-semibold text-gold-dark">{m.year}</div>
                <h3 className="mt-2 text-[20px] text-ink">{m.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">{m.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Master & Leadership Team */}
      <section className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <div className="smallcaps text-gold-dark">আমাদের কারিগর ও নেতৃত্ব</div>
        <h2 className="mt-2 text-[30px] sm:text-[38px]">যাঁদের হাতে তৈরি হয় আপনার পোশাক</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m) => (
            <article key={m.name} className="luxury-card flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-full bg-ink font-display text-[20px] text-gold">
                    {m.name.charAt(0)}
                  </div>
                  <Badge variant="gold">{m.exp}</Badge>
                </div>
                <h3 className="mt-4 text-[21px] text-ink">{m.name}</h3>
                <div className="smallcaps mt-0.5 text-stone">{m.role}</div>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink-3">{m.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicPage>
  );
}
