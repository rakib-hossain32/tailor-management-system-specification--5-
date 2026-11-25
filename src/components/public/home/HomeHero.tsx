import Image from "next/image";
import Link from "next/link";
import { Award, CalendarCheck, Ruler, Scissors, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicSection, PublicShop } from "@/server/cms/types";
import { asList, asRecord, asText } from "./content";

/**
 * Hero — "the cutting table", not a standard split hero.
 * Mobile first: one column, full-width actions, an arch-shaped portrait
 * (the atelier doorway) with the digital measurement card pinned over it
 * like a pattern card on the cutting table, and a gold stitch line running
 * through the whole section. Tablet keeps the stack with a wider arch;
 * desktop opens into an asymmetric 12-column composition.
 */
export function HomeHero({ section, title, intro, shop }: {
  section?: PublicSection;
  title: string;
  intro: string;
  shop: PublicShop;
}) {
  const data = asRecord(section?.data);
  const card = asRecord(data.measurementCard);
  const measurements = asList(card.measurements).map(asRecord);
  const promises = asList(data.promises).map(asRecord);
  const heading = section?.heading || title;
  const image = section?.imageUrl || shop.heroUrl;
  const hasCard = Object.keys(card).length > 0;

  return (
    <section className="relative overflow-hidden bg-ink text-paper">
      {/* stitch line weaving across the section */}
      <svg
        className="hero-stitch pointer-events-none absolute inset-x-0 top-16 h-40 w-full text-gold/50 sm:top-10"
        viewBox="0 0 1440 160"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M-20 120 C 240 20, 420 170, 720 80 S 1180 30, 1460 110" stroke="currentColor" strokeWidth="2" strokeDasharray="10 9" strokeLinecap="round" />
      </svg>
      {/* soft gold glow, top right */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gold/20 blur-3xl sm:size-96" aria-hidden />
      {/* faint measuring-tape ticks along the bottom edge */}
      <div className="ticks-h pointer-events-none absolute inset-x-0 bottom-0 h-[3px] opacity-70" aria-hidden />

      <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-14 pt-10 sm:px-6 sm:pt-14 lg:px-8 lg:pb-20 lg:pt-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-6">
          {/* ── Copy ── */}
          <div className="min-w-0 lg:col-span-7 lg:pr-10">
            <div className="flex flex-wrap items-center gap-2.5">
              {section?.label && (
                <span className="inline-flex items-center gap-2 rounded-full border border-gold/45 bg-gold/15 px-3.5 py-1.5 text-[13px] text-gold">
                  <Award className="size-4" />
                  {section.label}
                </span>
              )}
              {section?.subtitle && <span className="smallcaps text-paper/65">{section.subtitle}</span>}
              {shop.nameBn && <span className="smallcaps text-paper/50">{shop.nameBn}</span>}
            </div>

            <h1 className="mt-5 whitespace-pre-line font-display text-[40px] leading-[1.06] text-white sm:text-[58px] lg:text-[72px]">
              {heading}
            </h1>

            {(section?.body || intro) && (
              <p className="mt-5 max-w-xl whitespace-pre-line text-[16.5px] leading-relaxed text-paper/85 sm:text-[18px]">
                {section?.body || intro}
              </p>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild variant="gold" size="lg" className="min-h-12 w-full text-base sm:w-auto">
                <Link href="/book">
                  <CalendarCheck className="size-4" />
                  মাপ দিতে অ্যাপয়েন্টমেন্ট নিন
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-h-12 w-full border-white/30 bg-white/10 text-base text-white hover:bg-white/20 sm:w-auto">
                <a href="#track">
                  <SearchCheck className="size-4 text-gold" />
                  অর্ডার ট্র্যাক করুন
                </a>
              </Button>
              <Link href="/services" className="px-1 py-1 text-[15.5px] text-paper/85 hover:text-white">
                মূল্য তালিকা দেখুন →
              </Link>
            </div>

            {promises.length > 0 && (
              <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-4 border-t border-dashed border-gold/35 pt-6">
                {promises.map((promise, index) => (
                  <li key={index} className="flex items-baseline gap-2.5">
                    <span className="num text-[24px] font-semibold leading-none text-gold">{asText(promise.value)}</span>
                    <span className="max-w-[9rem] text-[13.5px] leading-tight text-paper/80">{asText(promise.label)}</span>
                  </li>
                ))}
              </ul>
            )}
            {shop.address && <p className="mt-5 whitespace-pre-line text-sm text-paper/65">{shop.address}</p>}
          </div>

          {/* ── Visual: arch portrait + pattern (measurement) card ── */}
          {(image || hasCard) && (
            <div className="relative mx-auto w-full max-w-md sm:max-w-lg lg:col-span-5 lg:max-w-none">
              {image && (
                <div className="relative mx-auto aspect-[4/5] w-[78%] overflow-hidden rounded-t-[999px] rounded-b-2xl border border-gold/40 shadow-[0_36px_70px_-32px_rgba(0,0,0,.9)] sm:w-[68%] lg:w-[74%]">
                  <Image src={image} alt={heading} fill priority sizes="(max-width: 1024px) 78vw, 34vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" aria-hidden />
                </div>
              )}

              {/* rotating atelier badge */}
              <div className="hero-badge absolute right-1 top-3 grid size-20 place-items-center rounded-full border border-gold/50 bg-ink/90 text-center shadow-lg sm:right-4 sm:size-24 lg:-right-1">
                <div>
                  <Scissors className="mx-auto size-5 text-gold sm:size-6" />
                  <p className="mt-1 px-2 text-[9.5px] leading-tight text-paper/85 sm:text-[10.5px]">কাটিং · সেলাই<br />ফিনিশিং</p>
                </div>
              </div>

              {hasCard && (
                <div className={`relative z-10 mx-auto w-full max-w-md ${image ? "-mt-16 sm:-mt-20 lg:-ml-2 lg:mr-auto" : ""}`}>
                  <div className="rotate-[-1.4deg] rounded-xl border-2 border-gold/70 bg-[#FBF6EC] p-1.5 text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,.85)] transition-transform duration-500 hover:rotate-0">
                    <div className="rounded-lg border border-ink/15 p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-3 border-b border-ink/15 pb-3.5">
                        <div>
                          <p className="smallcaps flex items-center gap-1.5 text-gold-dark">
                            <Ruler className="size-3.5" />
                            ডিজিটাল মাপ কার্ড
                          </p>
                          <h2 className="mt-1 text-[21px] font-semibold leading-snug">{asText(card.name)}</h2>
                          <p className="mt-0.5 text-sm text-ink-3">{asText(card.profile)}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-gold/20 px-3 py-1 text-sm font-medium">{asText(card.version)}</span>
                      </div>
                      <div className="mt-3.5 flex justify-between text-xs text-ink-3">
                        <span>শেষ আপডেট</span>
                        <span className="num">{asText(card.date)}</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2">
                        {measurements.map((item, index) => (
                          <div key={index} className="rounded-md border border-ink/10 bg-white/70 p-2.5 sm:p-3">
                            <dt className="truncate text-[11px] text-ink-3 sm:text-xs">{asText(item.label)}</dt>
                            <dd className="num mt-0.5 text-[17px] font-semibold leading-tight sm:text-[19px]">{asText(item.value)}</dd>
                            <dd className="num text-[11px] text-gold-dark sm:text-xs">{asText(item.change)}</dd>
                          </div>
                        ))}
                      </dl>
                      {asText(card.note) && <p className="mt-3.5 rounded-md bg-gold/15 px-3 py-2 text-xs text-ink-3">{asText(card.note)}</p>}
                      {asText(card.brand) && <p className="smallcaps mt-3.5 text-right text-stone">{asText(card.brand)}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
