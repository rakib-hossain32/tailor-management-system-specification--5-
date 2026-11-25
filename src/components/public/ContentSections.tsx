import Image from "next/image";
import type { PublicSiteSnapshot } from "@/server/cms/types";

type Section = PublicSiteSnapshot["pages"][string]["sections"][number];

export function ContentSections({ sections }: { sections: Section[] }) {
  if (!sections.length) return null;
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {[...sections].sort((a, b) => a.position - b.position).map((section) => (
        section.kind === "faq" ? (
          <details key={section.id} className="paper-card p-5">
            <summary className="cursor-pointer text-lg font-medium">{section.heading}</summary>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-3">{section.body}</p>
          </details>
        ) : (
          <article key={section.id} className="paper-card overflow-hidden">
            {section.imageUrl && <Image src={section.imageUrl} alt={section.heading || section.personName || ""} width={1000} height={700} sizes="(max-width: 768px) 100vw, 50vw" className="h-56 w-full object-cover" />}
            <div className="p-5 sm:p-6">
              {section.label && <div className="smallcaps mb-2 text-gold-dark">{section.label}</div>}
              {section.heading && <h2 className="text-[23px] leading-tight">{section.heading}</h2>}
              {section.subtitle && <p className="mt-2 text-[14px] text-stone">{section.subtitle}</p>}
              {section.kind === "testimonial" ? <blockquote className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink-2">{section.body}</blockquote> : <p className="mt-3 whitespace-pre-line text-[15.5px] leading-relaxed text-ink-3">{section.body}</p>}
              {section.personName && <p className="mt-4 border-t border-ink/10 pt-3 font-medium">{section.personName}</p>}
            </div>
          </article>
        )
      ))}
    </div>
  );
}
