import Link from "next/link";
import {
  ShieldCheck,
  Sparkles,
  Ruler,
  Clock,
  PhoneCall,
  MapPin,
  CalendarCheck,
  Share2,
  MessageCircle,
  Mail,
} from "lucide-react";
import { Logo } from "../Logo";
import { Button } from "@/components/ui/button";

const TRUST = [
  { icon: Ruler, title: "১০০% নিখুঁত ফিটিং", sub: "সিনিয়র মাস্টারের হাতে ভঙ্গি-ভিত্তিক মাপ" },
  { icon: ShieldCheck, title: "৭ দিনের ফ্রি অল্টারেশন", sub: "ডেলিভারির পর যেকোনো ফিট সংশোধন" },
  { icon: Sparkles, title: "ডিজিটাল মাপ আর্কাইভ", sub: "পরিবারের সবার মাপ আজীবন সংরক্ষিত" },
  { icon: Clock, title: "সময়মতো ডেলিভারি", sub: "প্রতিটি ধাপে SMS ও লাইভ ট্র্যাকিং" },
];

const SERVICE_LINKS: [string, string][] = [
  ["/services", "সার্ভিস ও মূল্য তালিকা"],
  ["/how-it-works", "কীভাবে কাজ করে"],
  ["/gallery", "কাজের গ্যালারি"],
  ["/about", "আমাদের গল্প ও দল"],
  ["/contact", "শোরুমের অবস্থান"],
];

const CUSTOMER_LINKS: [string, string][] = [
  ["/track", "অর্ডার ট্র্যাকিং"],
  ["/book", "অ্যাপয়েন্টমেন্ট বুকিং"],
  ["/login", "কাস্টমার পোর্টাল লগইন"],
  ["/account/measurements", "সংরক্ষিত মাপ কার্ড"],
  ["/terms", "ট্রায়াল ও অল্টারেশন নীতি"],
];

function LinkCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav className="min-w-0" aria-label={title}>
      <h3 className="smallcaps mb-4 text-gold">{title}</h3>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 lg:grid-cols-1 lg:gap-x-0">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="chalk-link inline-block max-w-full truncate text-[14.5px] text-paper/80 transition-colors hover:text-white"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-gold/30 bg-ink text-paper">
      {/* trust strip */}
      <div className="border-b border-white/10 bg-white/[0.03]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {TRUST.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex min-w-0 items-start gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/35">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15.5px] font-semibold text-white">{item.title}</h3>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-paper/70">{item.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* main columns */}
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
        {/* brand */}
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/40">
              <Logo size={28} />
            </span>
            <div className="min-w-0">
              <div className="font-display text-[22px] text-white">রহমান টেইলার্স</div>
              <div className="smallcaps text-[9.5px] text-gold">Bespoke Atelier · Est. 1994</div>
            </div>
          </div>

          <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-paper/75">
            তিন দশকের কারুশিল্প ও আধুনিক ডিজিটাল ব্যবস্থাপনার সমন্বয়ে ঢাকার অন্যতম বিশ্বস্ত কাস্টম
            টেইলরিং হাউস — শার্ট, পাঞ্জাবি, স্যুট, শেরওয়ানি ও লেডিস বেসপোক।
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="https://m.me/rahimantailors"
              className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[13.5px] text-paper/85 transition-colors hover:border-gold/50 hover:text-white"
            >
              <Share2 className="size-4 text-gold" />
              ফেসবুক
            </a>
            <a
              href="https://wa.me/8801711000001"
              className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[13.5px] text-paper/85 transition-colors hover:border-gold/50 hover:text-white"
            >
              <MessageCircle className="size-4 text-gold" />
              WhatsApp
            </a>
            <a
              href="mailto:order@rahimantailors.com"
              className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[13.5px] text-paper/85 transition-colors hover:border-gold/50 hover:text-white"
            >
              <Mail className="size-4 text-gold" />
              ইমেইল
            </a>
          </div>

          <div className="mt-5">
            <div className="smallcaps mb-2 text-[10px] text-gold/80">পেমেন্ট</div>
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              {["ক্যাশ", "bKash", "Nagad", "Rocket", "কার্ড"].map((m) => (
                <span
                  key={m}
                  className="rounded-sm border border-white/15 bg-white/5 px-2.5 py-1 text-paper/85"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        <LinkCol title="সেবা ও তথ্য" links={SERVICE_LINKS} />
        <LinkCol title="কাস্টমার সেবা" links={CUSTOMER_LINKS} />

        {/* showroom */}
        <div className="min-w-0">
          <h3 className="smallcaps mb-4 text-gold">ধানমন্ডি শোরুম</h3>
          <ul className="space-y-3 text-[14.5px] text-paper/80">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
              <span className="min-w-0">১২/বি, ধানমন্ডি (৩২ নম্বর ব্রিজের পাশে), ঢাকা-১২০৯</span>
            </li>
            <li className="flex items-center gap-2.5">
              <PhoneCall className="size-4 shrink-0 text-gold" />
              <a href="tel:+8801711000001" className="num chalk-link hover:text-white">
                ০১৭১১-০০০০০১
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="size-4 shrink-0 text-gold" />
              <span>শনি–বৃহস্পতি · সকাল ১০টা – রাত ৯টা</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="size-4 shrink-0 text-center text-gold">✕</span>
              <span>সাপ্তাহিক ছুটি: শুক্রবার</span>
            </li>
          </ul>

          <div className="mt-5 space-y-2.5">
            <Button asChild variant="gold" className="w-full">
              <Link href="/book">
                <CalendarCheck className="size-4" />
                অ্যাপয়েন্টমেন্ট নিন
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full border-white/25 bg-white/5 text-white hover:bg-white/15"
            >
              <Link href="/track">
                <PhoneCall className="size-4 text-gold" />
                অর্ডার ট্র্যাকিং
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* bottom bar */}
      <div className="border-t border-white/10 bg-black/25">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-3 px-4 py-4 text-center text-[13px] text-paper/65 sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <span className="min-w-0">
            © {new Date().getFullYear()} রহমান টেইলার্স · সর্বস্বত্ব সংরক্ষিত
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/privacy" className="chalk-link hover:text-white">
              গোপনীয়তা
            </Link>
            <Link href="/terms" className="chalk-link hover:text-white">
              শর্তাবলি
            </Link>
            <Link href="/admin" className="chalk-link text-gold hover:text-white">
              স্টাফ লগইন
            </Link>
            <Link href="/worker" className="chalk-link hover:text-white">
              কারিগর ভিউ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
