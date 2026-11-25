import Image from "next/image";
import { FaqItem } from "./FaqItem";
import type { PublicSiteSnapshot } from "@/server/cms/types";
import { asList, asRecord, asText } from "./home/content";

type Section = PublicSiteSnapshot["pages"][string]["sections"][number];

function SectionHeading({ section }: { section: Section }) {
  return <header className="col-span-full mb-1 border-b border-gold/30 pb-4">
    {section.label && <div className="smallcaps text-gold-dark">{section.label}</div>}
    <h2 className="mt-1 whitespace-pre-line text-[28px] leading-tight sm:text-[34px]">{section.heading}</h2>
    {section.body && <p className="mt-2 max-w-3xl whitespace-pre-line text-[15.5px] leading-relaxed text-ink-3">{section.body}</p>}
  </header>;
}

function SectionCard({ section }: { section: Section }) {
  const data = asRecord(section.data);
  const features = asList(data.features).filter((item): item is string => typeof item === "string");
  const price = typeof data.price === "number" || typeof data.price === "string" ? asText(String(data.price)) : "";
  const card = <article className="paper-card overflow-hidden">
    {section.imageUrl && <Image src={section.imageUrl} alt={section.heading || section.personName || ""} width={1000} height={700} sizes="(max-width: 768px) 100vw, 50vw" className="h-56 w-full object-cover" />}
    <div className="p-5 sm:p-6">
      {section.label && <div className="smallcaps mb-2 text-gold-dark">{section.label}</div>}
      <h2 className="text-[23px] leading-snug">{section.heading}</h2>
      {section.subtitle && <p className="mt-2 text-[14px] text-stone">{section.subtitle}</p>}
      {section.kind === "testimonial" ? <blockquote className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink-2">{section.body}</blockquote> : <p className="mt-3 whitespace-pre-line text-[15.5px] leading-relaxed text-ink-3">{section.body}</p>}
      {features.length > 0 && <ul className="mt-4 space-y-1 text-sm text-ink-3">{features.map((feature) => <li key={feature}>• {feature}</li>)}</ul>}
      {(data.days != null || data.fabric != null || price) && <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink/10 pt-3 text-sm"><div>{price && <><dt className="text-ink-3">সেলাই মজুরি</dt><dd className="num text-lg font-semibold">৳ {Number(price).toLocaleString("en-US")}</dd></>}</div>{data.days != null && <div><dt className="text-ink-3">সময়</dt><dd>{asText(data.days)}</dd></div>}{data.fabric != null && <div><dt className="text-ink-3">কাপড়</dt><dd>{asText(data.fabric)}</dd></div>}</dl>}
      {section.personName && <p className="mt-4 border-t border-ink/10 pt-3 font-medium">{section.personName}</p>}
    </div>
  </article>;
  const rawHref = asText(data.href);
  const href = /^(https:\/\/|mailto:|tel:|\/)/i.test(rawHref) ? rawHref : "";
  return href ? <a key={section.id} href={href} rel={href.startsWith("https://") ? "noreferrer" : undefined} className="block min-w-0">{card}</a> : <div key={section.id}>{card}</div>;
}

export function ContentSections({ sections }: { sections: Section[] }) {
  if (!sections.length) return null;
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    {[...sections].sort((a, b) => a.position - b.position).map((section) => {
      const data = asRecord(section.data);
      if (data.sectionHeader === true) return <SectionHeading key={section.id} section={section} />;
      if (section.kind === "faq") return <FaqItem key={section.id} heading={section.heading} body={section.body} />;
      if (section.kind === "statistic") return <article key={section.id} className="paper-card p-5"><div className="num text-[30px] font-semibold text-gold-dark">{section.label}</div><h2 className="mt-1 text-[18px]">{section.heading}</h2>{section.body && <p className="mt-2 text-sm text-ink-3">{section.body}</p>}</article>;
      return <SectionCard key={section.id} section={section} />;
    })}
  </div>;
}
