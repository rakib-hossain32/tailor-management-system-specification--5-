import type { PublicSection } from "@/server/cms/types";

/**
 * Stats — the same quiet language as the hero: paper background, hairline
 * rules, gold micro-labels above confident numbers. Mobile: a calm 2×2
 * with hairline dividers; desktop: four across.
 */
export function HomeStats({ sections }: { sections: PublicSection[] }) {
  if (!sections.length) return null;
  return (
    <section className="border-y border-ink/10 bg-paper">
      <dl className="mx-auto grid max-w-[1280px] grid-cols-2 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={`flex flex-col px-2 py-8 sm:px-6 sm:py-10 ${
              index % 2 === 1 ? "border-l border-ink/10" : ""
            } ${index >= 2 ? "border-t border-ink/10 lg:border-t-0" : ""} ${
              index > 0 ? "lg:border-l lg:border-ink/10" : ""
            } ${index === 2 ? "lg:border-l-0" : ""}`}
          >
            <dt className="order-2 mt-2.5 text-[13px] leading-snug text-ink-3">{section.heading}</dt>
            <dd className="order-1 text-[34px] font-semibold leading-none tracking-tight text-ink sm:text-[42px]">
              {section.label}
              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-gold align-middle" aria-hidden />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
