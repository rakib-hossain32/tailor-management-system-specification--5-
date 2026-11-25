"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhoneCall, CalendarCheck, SearchCheck, Menu, MapPin, UserCheck } from "lucide-react";
import { useShop } from "@/components/ShopContext";
import { ShopLogo } from "@/components/ShopBrand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const LINKS: [string, string][] = [["/", "হোম"], ["/services", "সার্ভিস ও মূল্য"], ["/how-it-works", "কীভাবে কাজ করে"], ["/gallery", "গ্যালারি"], ["/about", "আমাদের সম্পর্কে"], ["/contact", "যোগাযোগ"]];

export function SiteHeader() {
  const shop = useShop();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const name = shop.nameBn || shop.nameEn;
  return <>
    <div className="no-print border-b border-gold/25 bg-ink text-paper">
      <div className="mx-auto flex max-w-[1280px] items-center gap-5 overflow-hidden px-4 py-2 text-[12px] sm:px-6">
        <span className="min-w-0 truncate text-gold">{shop.tagline || name}</span>
        {shop.address && <span className="hidden min-w-0 items-center gap-1.5 truncate text-paper/75 md:inline-flex"><MapPin className="size-3.5 shrink-0" />{shop.address}</span>}
        {shop.phone && <a href={`tel:${shop.phone}`} className="ml-auto flex shrink-0 items-center gap-1.5 text-gold"><PhoneCall className="size-3.5" /><span className="hidden sm:inline">{shop.phone}</span><span className="sm:hidden">কল করুন</span></a>}
      </div>
    </div>
    <header className="no-print sticky top-0 z-40 border-b border-ink/10 bg-white/95 shadow-2xs backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2 sm:gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ink text-gold ring-1 ring-gold/40"><ShopLogo size={25} /></span><span className="min-w-0 leading-tight"><span className="block truncate font-display text-[17px] sm:text-[20px]">{name}</span>{shop.nameEn && <span className="smallcaps hidden truncate text-[9px] text-gold-dark sm:block">{shop.nameEn}{shop.foundedYear ? ` · ${shop.foundedYear}` : ""}</span>}</span></Link>
        <nav className="mx-auto hidden items-center gap-5 text-[15px] lg:flex" aria-label="প্রধান মেনু">{LINKS.map(([href, label]) => <Link key={href} href={href} className={`whitespace-nowrap border-b-2 py-1 ${pathname === href ? "border-gold font-medium" : "border-transparent text-ink-3 hover:text-ink"}`}>{label}</Link>)}</nav>
        <div className="ml-auto hidden shrink-0 gap-2 sm:flex lg:ml-0"><Button asChild variant="outline"><Link href="/track"><SearchCheck className="size-4 text-gold-dark" />ট্র্যাক</Link></Button><Button asChild variant="gold"><Link href="/book"><CalendarCheck className="size-4" />বুকিং</Link></Button></div>
        <div className="ml-auto flex shrink-0 gap-2 sm:hidden"><Button asChild variant="outline" size="sm"><Link href="/track">ট্র্যাক</Link></Button><Button size="sm" onClick={() => setOpen(true)} aria-label="মেনু খুলুন"><Menu className="size-4" />মেনু</Button></div>
        <Button variant="outline" className="hidden shrink-0 sm:inline-flex lg:hidden" onClick={() => setOpen(true)} aria-label="মেনু খুলুন"><Menu className="size-4" /></Button>
      </div>
    </header>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] w-[92vw] max-w-sm overflow-y-auto border-gold/30 bg-ink text-paper"><DialogTitle className="flex items-center gap-3"><ShopLogo size={28} /><span className="min-w-0 truncate">{name}</span></DialogTitle><DialogDescription className="text-paper/70">পাতা ও কাস্টমার পরিষেবা</DialogDescription><nav className="grid gap-1">{LINKS.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`rounded-md px-3 py-2.5 ${pathname === href ? "bg-gold text-ink" : "hover:bg-white/10"}`}>{label}</Link>)}</nav><div className="grid gap-2 border-t border-white/10 pt-4"><Button asChild variant="gold"><Link href="/book" onClick={() => setOpen(false)}><CalendarCheck className="size-4" />অ্যাপয়েন্টমেন্ট নিন</Link></Button><Button asChild variant="outline"><Link href="/login" onClick={() => setOpen(false)}><UserCheck className="size-4" />কাস্টমার পোর্টাল</Link></Button></div>{shop.address && <p className="whitespace-pre-line text-sm text-paper/75">{shop.address}</p>}{shop.phone && <a href={`tel:${shop.phone}`} className="text-gold">{shop.phone}</a>}</DialogContent></Dialog>
  </>;
}