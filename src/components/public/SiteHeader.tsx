"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PhoneCall,
  CalendarCheck,
  SearchCheck,
  UserCheck,
  Menu,
  MapPin,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "../Logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const LINKS: [string, string][] = [
  ["/", "হোম"],
  ["/services", "সার্ভিস ও মূল্য"],
  ["/how-it-works", "কীভাবে কাজ করে"],
  ["/gallery", "গ্যালারি"],
  ["/about", "আমাদের সম্পর্কে"],
  ["/contact", "যোগাযোগ"],
];

/**
 * Public site header.
 * Responsive rules that matter:
 *  - every flex child that can grow gets min-w-0 + truncate
 *  - nothing has a fixed width that exceeds 320px viewports
 *  - the whole header clips horizontally (overflow-hidden) so a stray element
 *    can never produce a page-level horizontal scrollbar
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Heritage ribbon */}
      <div className="no-print overflow-hidden border-b border-gold/25 bg-ink text-paper">
        <div className="mx-auto flex max-w-[1280px] items-center gap-x-5 gap-y-1 overflow-hidden px-4 py-2 sm:px-6">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] text-gold">
            <ShieldCheck className="size-3.5 shrink-0" />
            <span className="truncate">১৯৯৪ সাল থেকে বিশ্বস্ত বেসপোক টেইলরিং হাউস</span>
          </span>
          <span className="hidden min-w-0 items-center gap-1.5 text-[12.5px] text-paper/75 md:inline-flex">
            <MapPin className="size-3.5 shrink-0 text-gold" />
            <span className="truncate">১২/বি, ধানমন্ডি, ঢাকা-১২০৯</span>
          </span>
          <span className="hidden min-w-0 items-center gap-1.5 text-[12.5px] text-paper/75 lg:inline-flex">
            <Clock className="size-3.5 shrink-0 text-gold" />
            <span className="truncate">শনি–বৃহস্পতি: সকাল ১০টা – রাত ৯টা</span>
          </span>

          <span className="ml-auto flex shrink-0 items-center gap-3">
            <a
              href="tel:+8801711000001"
              className="num inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gold hover:underline"
            >
              <PhoneCall className="size-3.5" />
              <span className="hidden sm:inline">০১৭১১-০০০০০১</span>
              <span className="sm:hidden">কল</span>
            </a>
            <Link
              href="/login"
              className="hidden text-[12.5px] text-paper/85 hover:text-gold sm:inline"
            >
              কাস্টমার পোর্টাল
            </Link>
          </span>
        </div>
      </div>

      {/* Main bar */}
      <header className="no-print sticky top-0 z-40 overflow-hidden border-b border-ink/10 bg-white/95 shadow-2xs backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          {/* Brand — shrinks instead of overflowing */}
          <Link href="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-gold shadow-xs ring-1 ring-gold/40 sm:size-10">
              <Logo size={24} />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-[17px] tracking-tight text-ink sm:text-[20px]">
                রহমান টেইলার্স
              </span>
              <span className="smallcaps hidden truncate text-[9.5px] text-gold-dark sm:block">
                Bespoke Tailors · Est. 1994
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="mx-auto hidden items-center gap-5 text-[15px] lg:flex xl:gap-6" aria-label="প্রধান মেনু">
            {LINKS.map(([href, label]) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative whitespace-nowrap py-1 transition-colors ${
                    active
                      ? "font-medium text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-gold"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Actions — desktop/tablet */}
          <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex lg:ml-0">
            <Button asChild variant="outline" size="default" className="whitespace-nowrap">
              <Link href="/track">
                <SearchCheck className="size-4 text-gold-dark" />
                <span className="hidden md:inline">অর্ডার ট্র্যাক</span>
                <span className="md:hidden">ট্র্যাক</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="default" className="hidden xl:inline-flex">
              <Link href="/login">
                <UserCheck className="size-4" />
                পোর্টাল
              </Link>
            </Button>
            <Button asChild variant="gold" size="default" className="whitespace-nowrap">
              <Link href="/book">
                <CalendarCheck className="size-4" />
                <span className="hidden md:inline">অ্যাপয়েন্টমেন্ট</span>
                <span className="md:hidden">বুকিং</span>
              </Link>
            </Button>
          </div>

          {/* Mobile actions */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:hidden">
            <Button asChild variant="outline" size="sm" className="px-3">
              <Link href="/track">ট্র্যাক</Link>
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setOpen(true)}
              aria-label="মেনু খুলুন"
              className="px-3"
            >
              <Menu className="size-4" />
              মেনু
            </Button>
          </div>

          {/* Tablet / small-desktop menu trigger — hidden on phones (they use the bar above) */}
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => setOpen(true)}
            className="hidden shrink-0 sm:inline-flex lg:hidden"
            aria-label="মেনু খুলুন"
          >
            <Menu className="size-4" />
            মেনু
          </Button>
        </div>
      </header>

      {/* Drawer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[92vw] max-w-sm overflow-y-auto thin-scroll overflow-x-hidden border-gold/30 bg-ink p-0 text-paper">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold/15 text-gold">
                <Logo size={22} />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate font-display text-lg text-white">
                  রহমান টেইলার্স
                </DialogTitle>
                <div className="smallcaps truncate text-[9.5px] text-gold">ধানমন্ডি, ঢাকা · ১৯৯৪</div>
              </div>
            </div>
            {/* close button comes from DialogContent (single cross only) */}
          </div>

          <div className="space-y-5 p-5">
            <nav className="flex flex-col gap-1">
              {LINKS.map(([href, label]) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-md px-3.5 py-2.5 text-[15.5px] ${
                      active ? "bg-gold font-medium text-ink" : "text-white/85 hover:bg-white/10"
                    }`}
                  >
                    <span>{label}</span>
                    <span aria-hidden className="text-xs opacity-60">→</span>
                  </Link>
                );
              })}
            </nav>

            <div className="grid grid-cols-1 gap-2.5 border-t border-white/10 pt-4">
              <Button asChild variant="gold" className="w-full">
                <Link href="/book" onClick={() => setOpen(false)}>
                  <CalendarCheck className="size-4" />
                  মাপ দিতে অ্যাপয়েন্টমেন্ট নিন
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full border-white/25 bg-white/10 text-white hover:bg-white/20"
              >
                <Link href="/track" onClick={() => setOpen(false)}>
                  <SearchCheck className="size-4 text-gold" />
                  অর্ডার ট্র্যাকিং
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full border-white/25 bg-white/5 text-white hover:bg-white/15"
              >
                <Link href="/login" onClick={() => setOpen(false)}>
                  <UserCheck className="size-4 text-gold" />
                  কাস্টমার পোর্টাল লগইন
                </Link>
              </Button>
            </div>

            <div className="rounded-md border border-gold/25 bg-white/5 p-3.5 text-[13.5px] text-white/80">
              <div className="font-medium text-gold">শোরুম ও হটলাইন</div>
              <p className="mt-1">১২/বি, ধানমন্ডি, ঢাকা-১২০৯</p>
              <p className="num mt-0.5">ফোন: ০১৭১১-০০০০০১</p>
              <p className="mt-0.5 text-[12.5px] text-white/60">সকাল ১০টা – রাত ৯টা (শুক্রবার ছুটি)</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
