import Link from "next/link";
import { ArrowRight, MapPin, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicSection, PublicShop } from "@/server/cms/types";

/**
 * Call-to-action — a floating card on the light page background, clearly
 * separate from the dark footer below it (the old full-bleed dark band
 * merged with the footer into one giant block). The card uses the shop
 * photo under a deep-ink overlay; the page's whitespace frames it.
 */
export function HomeVisitCTA({ section, shop }: { section?: PublicSection; shop: PublicShop }) {
  if (!section) return null;
  const bg = section.imageUrl || shop.aboutUrl;
  return (
    <section className="bg-paper px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[2rem] bg-ink text-paper shadow-[0_30px_60px_-30px_rgba(15,26,44,0.5)]">
        {bg && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40" aria-hidden />
          </>
        )}
        <div className="relative grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[1fr_auto] lg:px-14 lg:py-16">
          <div className="min-w-0">
            {section.label && (
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-gold" aria-hidden />
                <span className="text-[12.5px] font-semibold uppercase tracking-[0.18em] text-gold">{section.label}</span>
              </div>
            )}
            <h2 className="mt-4 max-w-3xl whitespace-pre-line text-[28px] font-semibold leading-tight sm:text-4xl">
              {section.heading}
            </h2>
            {section.body && (
              <p className="mt-3 max-w-3xl whitespace-pre-line text-[15.5px] leading-relaxed text-paper/80">{section.body}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper/75">
              {shop.address && (
                <span className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                  <span className="whitespace-pre-line">{shop.address}</span>
                </span>
              )}
              {shop.phone && (
                <a className="num flex items-center gap-2 text-gold" href={`tel:${shop.phone}`}>
                  <PhoneCall className="size-4" />
                  {shop.phone}
                </a>
              )}
            </div>
          </div>
          <Button asChild variant="gold" size="lg" className="min-h-[52px] w-full rounded-full px-8 text-base lg:w-auto">
            <Link href="/book">
              {typeof section.data.button === "string" ? section.data.button : "অনলাইনে অ্যাপয়েন্টমেন্ট নিন"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
