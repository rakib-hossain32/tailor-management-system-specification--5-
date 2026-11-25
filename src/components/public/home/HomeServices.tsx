import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { taka } from "@/lib/format";
import type { PublicSection } from "@/server/cms/types";
import { asList, asRecord, asText } from "./content";

export function HomeServices({ heading, sections }: { heading?: PublicSection; sections: PublicSection[] }) {
  if (!sections.length) return null;
  return <section className="border-y border-ink/10 bg-paper-2/60"><div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>{heading?.label && <div className="smallcaps text-gold-dark">{heading.label}</div>}<h2 className="mt-2 whitespace-pre-line text-[30px] leading-tight sm:text-[36px]">{heading?.heading || "সার্ভিস ও মূল্য"}</h2>{heading?.body && <p className="mt-2 max-w-2xl text-ink-3">{heading.body}</p>}</div><Link href="/services" className="inline-flex items-center gap-2 text-gold-dark">সব সার্ভিস দেখুন<ArrowRight className="size-4" /></Link></div><ServiceCards sections={sections} /></div></section>;
}

export function ServiceCards({ sections }: { sections: PublicSection[] }) {
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{sections.map((section) => {
    const data = asRecord(section.data);
    const features = asList(data.features).filter((item): item is string => typeof item === "string");
    const price = typeof data.price === "number" || typeof data.price === "string" ? data.price : null;
    return <article key={section.id} className="paper-card overflow-hidden">{section.imageUrl && <Image src={section.imageUrl} width={1000} height={700} sizes="(max-width: 768px) 100vw, 33vw" alt={section.heading} className="h-48 w-full object-cover" />}<div className="p-5 sm:p-6">{section.label && <div className="smallcaps text-gold-dark">{section.label}</div>}<h3 className="mt-1 text-[23px] leading-snug">{section.heading}</h3><p className="mt-3 text-[15px] leading-relaxed text-ink-3">{section.body}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-stone">{data.days != null && <span className="rounded-full bg-paper-2 px-3 py-1">সময়: {asText(data.days)}</span>}{data.fabric != null && <span className="rounded-full bg-paper-2 px-3 py-1">কাপড়: {asText(data.fabric)}</span>}</div>{features.length > 0 && <ul className="mt-4 space-y-1.5 text-sm text-ink-3">{features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-gold-dark">✓</span><span>{feature}</span></li>)}</ul>}<div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/10 pt-4"><strong className="num text-xl font-semibold">{price === null ? "" : taka(price)}</strong><Button asChild variant="outline"><Link href="/book">অ্যাপয়েন্টমেন্ট</Link></Button></div></div></article>;
  })}</div>;
}
