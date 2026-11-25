import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { asText } from "../content";

/**
 * Overlay copy for the cinematic hero — set low over the photograph,
 * the way a fashion-house cover sets its masthead. One headline, one
 * supporting line, two actions, and a quiet proof strip along the
 * bottom edge. No cards, no columns, nothing floating.
 */
export function HeroOverlay({
  label,
  heading,
  body,
  promises,
}: {
  label?: string;
  heading: string;
  body?: string;
  promises: Array<Record<string, unknown>>;
}) {
  return (
    <div className="relative flex flex-1 flex-col justify-end">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-10 pt-40 sm:px-6 sm:pb-12 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="h-px w-12 bg-gold" aria-hidden />
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.22em] text-gold">
            {label || "বেসপোক টেইলরিং"}
          </span>
        </div>

        <h1 className="mt-6 max-w-4xl whitespace-pre-line text-[42px] font-semibold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[76px]">
          {heading}
        </h1>

        {body && (
          <p className="mt-6 max-w-xl whitespace-pre-line text-base leading-relaxed text-white/85 sm:text-lg">
            {body}
          </p>
        )}

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild variant="gold" size="lg" className="min-h-[54px] w-full rounded-full px-9 text-base shadow-[0_18px_36px_-12px_rgba(200,164,90,0.55)] sm:w-auto">
            <Link href="/book">অ্যাপয়েন্টমেন্ট নিন</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="group min-h-[54px] w-full rounded-full border-white/35 bg-white/10 px-8 text-base text-white backdrop-blur-md hover:bg-white/20 hover:text-white sm:w-auto"
          >
            <Link href="/services">
              সার্ভিস ও মূল্য দেখুন
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        {promises.length > 0 && (
          <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-white/15 pt-6 sm:gap-10">
            {promises.slice(0, 3).map((promise, index) => (
              <div key={index} className="min-w-0">
                <dd className="num truncate text-xl font-semibold leading-none text-white sm:text-[26px]">
                  {asText(promise.value)}
                </dd>
                <dt className="mt-2 truncate text-[12px] leading-snug text-white/65 sm:text-[13px]">
                  {asText(promise.label)}
                </dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
