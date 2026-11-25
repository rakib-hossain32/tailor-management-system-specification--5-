import { SearchCheck } from "lucide-react";
import { TrackForm } from "@/components/TrackForm";
import type { PublicSection } from "@/server/cms/types";
import { asList, asText } from "./content";

export function HomeTracking({ section }: { section?: PublicSection }) {
  if (!section) return null;
  const benefits = asList(section.data.benefits).filter((item): item is string => typeof item === "string");
  return <section id="track" className="scroll-mt-24 border-y border-ink/10 bg-paper-2/60"><div className="mx-auto grid max-w-[1280px] items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[.9fr_1.1fr]">
    <div><div className="smallcaps flex items-center gap-2 text-gold-dark"><SearchCheck className="size-4" />{section.label}</div><h2 className="mt-3 whitespace-pre-line text-[30px] leading-tight sm:text-[36px]">{section.heading}</h2><p className="mt-4 whitespace-pre-line text-ink-3">{section.body}</p>{benefits.length > 0 && <ul className="mt-5 space-y-2 text-sm text-ink-3">{benefits.map((benefit) => <li key={benefit} className="flex gap-2"><span className="text-gold-dark">✓</span><span>{asText(benefit)}</span></li>)}</ul>}</div>
    <div className="paper-card p-5 sm:p-7"><TrackForm compact /></div>
  </div></section>;
}
