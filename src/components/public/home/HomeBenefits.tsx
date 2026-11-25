import { Ruler, Scissors, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PublicSection } from "@/server/cms/types";

const ICONS: Record<string, LucideIcon> = { ruler: Ruler, scissors: Scissors, shield: ShieldCheck, sparkles: Sparkles };

export function HomeBenefits({ heading, sections }: { heading?: PublicSection; sections: PublicSection[] }) {
  if (!sections.length) return null;
  return <section className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14"><div className="mb-8 max-w-3xl">{heading?.label && <div className="smallcaps text-gold-dark">{heading.label}</div>}<h2 className="mt-2 whitespace-pre-line text-[30px] leading-tight sm:text-[38px]">{heading?.heading}</h2>{heading?.body && <p className="mt-3 text-[16px] leading-relaxed text-ink-3">{heading.body}</p>}</div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{sections.map((section) => { const Icon = ICONS[section.label] ?? Sparkles; return <article key={section.id} className="paper-card p-5 sm:p-6"><span className="flex size-11 items-center justify-center rounded-lg bg-gold/20 text-gold-dark"><Icon className="size-5" /></span><h3 className="mt-4 text-[21px] leading-snug">{section.heading}</h3><p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">{section.body}</p></article>; })}</div></section>;
}
