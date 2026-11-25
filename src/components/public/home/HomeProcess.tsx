import Image from "next/image";
import type { PublicSection } from "@/server/cms/types";

export function HomeProcess({ heading, sections }: { heading?: PublicSection; sections: PublicSection[] }) {
  if (!sections.length) return null;
  return <section className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14"><div className="mb-8">{heading?.label && <div className="smallcaps text-gold-dark">{heading.label}</div>}<h2 className="mt-2 whitespace-pre-line text-[30px] leading-tight sm:text-[38px]">{heading?.heading}</h2>{heading?.body && <p className="mt-2 text-ink-3">{heading.body}</p>}</div><ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{sections.map((section) => <li key={section.id} className="paper-card overflow-hidden"><div className="relative">{section.imageUrl && <Image src={section.imageUrl} width={900} height={650} sizes="(max-width: 640px) 100vw, 50vw" alt={section.heading} className="h-44 w-full object-cover" />}<span className="num absolute right-3 top-3 rounded-full bg-ink px-3 py-1 text-sm text-gold">{section.label}</span></div><div className="p-5"><h3 className="text-[20px] leading-snug">{section.heading}</h3><p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">{section.body}</p></div></li>)}</ol></section>;
}
