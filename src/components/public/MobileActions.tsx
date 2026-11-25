"use client";

import Link from "next/link";
import { CalendarCheck, PhoneCall } from "lucide-react";
import { useShop } from "@/components/ShopContext";

export function MobileActions() {
  const shop = useShop();
  return <><div className={`no-print fixed inset-x-0 bottom-0 z-40 grid ${shop.phone ? "grid-cols-2" : "grid-cols-1"} border-t border-gold/40 bg-ink text-paper shadow-2xl sm:hidden`}>{shop.phone && <a href={`tel:${shop.phone}`} className="flex items-center justify-center gap-2 py-3 text-sm"><PhoneCall className="size-4 text-gold" />কল করুন</a>}<Link href="/book" className="flex items-center justify-center gap-2 bg-gold py-3 text-sm font-medium text-ink"><CalendarCheck className="size-4" />অ্যাপয়েন্টমেন্ট</Link></div><div className="h-12 sm:hidden" aria-hidden /></>;
}
