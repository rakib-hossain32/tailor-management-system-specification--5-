import type { PublicSection } from "@/server/cms/types";

export function HomeStats({ sections }: { sections: PublicSection[] }) {
  if (!sections.length) return null;
  return <section className="border-b border-ink/10 bg-gold"><div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-6 px-4 py-7 sm:px-6 lg:grid-cols-4">{sections.map((section) => <div key={section.id}><div className="num text-[30px] font-semibold">{section.label}</div><div className="mt-1 text-sm">{section.heading}</div></div>)}</div></section>;
}
