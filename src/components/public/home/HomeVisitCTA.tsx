import Link from "next/link";
import { ArrowRight, MapPin, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicSection, PublicShop } from "@/server/cms/types";

export function HomeVisitCTA({ section, shop }: { section?: PublicSection; shop: PublicShop }) {
  if (!section) return null;
  return <section className="bg-ink text-paper"><div className="mx-auto grid max-w-[1280px] items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_auto] lg:py-14"><div>{section.label && <div className="smallcaps text-gold">{section.label}</div>}<h2 className="mt-2 max-w-3xl whitespace-pre-line text-[30px] leading-tight sm:text-[38px]">{section.heading}</h2>{section.body && <p className="mt-3 max-w-3xl text-[15.5px] leading-relaxed text-paper/75">{section.body}</p>}<div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-paper/70">{shop.address && <span className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-gold" />{shop.address}</span>}{shop.phone && <a className="flex items-center gap-2 text-gold" href={`tel:${shop.phone}`}><PhoneCall className="size-4" />{shop.phone}</a>}</div></div><Button asChild variant="gold" size="lg"><Link href="/book">{typeof section.data.button === "string" ? section.data.button : "অনলাইনে অ্যাপয়েন্টমেন্ট নিন"}<ArrowRight className="size-4" /></Link></Button></div></section>;
}
