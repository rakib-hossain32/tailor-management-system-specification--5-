import Image from "next/image";
import Link from "next/link";
import { Award, CalendarCheck, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicSection, PublicShop } from "@/server/cms/types";
import { asList, asRecord, asText } from "./content";

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

  return (
    <section className="relative overflow-hidden border-b border-gold/30 bg-ink text-paper">
      {image && <Image src={image} alt={heading} fill priority sizes="100vw" className="object-cover opacity-35" />}
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(15,26,44,.98)_0%,rgba(15,26,44,.91)_48%,rgba(15,26,44,.68)_100%)]" aria-hidden />
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.12fr_.88fr] lg:py-24">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {section?.label && <span className="inline-flex items-center gap-2 rounded-full border border-gold/45 bg-gold/15 px-4 py-1.5 text-[13px] text-gold"><Award className="size-4" />{section.label}</span>}
            {section?.subtitle && <span className="smallcaps text-paper/65">{section.subtitle}</span>}
          </div>
          <h1 className="mt-5 whitespace-pre-line font-display text-[38px] leading-[1.08] text-white sm:text-[56px] lg:text-[66px]">{heading}</h1>
          {(section?.body || intro) && <p className="mt-5 max-w-2xl whitespace-pre-line border-l border-gold/70 pl-4 text-[16.5px] leading-relaxed text-paper/85 sm:text-[18px]">{section?.body || intro}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild variant="gold" size="lg"><Link href="/book"><CalendarCheck className="size-4" />মাপ দিতে অ্যাপয়েন্টমেন্ট নিন</Link></Button>
            <Button asChild variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20"><a href="#track"><SearchCheck className="size-4 text-gold" />অর্ডার ট্র্যাক করুন</a></Button>
            <Link href="/services" className="px-1 text-[15.5px] text-paper/85 hover:text-white">মূল্য তালিকা দেখুন →</Link>
          </div>
          {promises.length > 0 && <ul className="mt-9 grid max-w-2xl gap-3 border-t border-white/15 pt-6 sm:grid-cols-3">{promises.map((promise, index) => <li key={index} className="flex items-baseline gap-2.5"><span className="num text-[22px] font-semibold leading-none text-gold">{asText(promise.value)}</span><span className="text-[14px] leading-tight text-paper/80">{asText(promise.label)}</span></li>)}</ul>}
          {shop.address && <p className="mt-5 whitespace-pre-line text-sm text-paper/65">{shop.address}</p>}
        </div>
        {Object.keys(card).length > 0 && <div className="mx-auto w-full max-w-md lg:max-w-none">
          <div className="rotate-[-1.2deg] rounded-xl border-2 border-gold/70 bg-[#FBF6EC] p-1.5 text-ink shadow-[0_30px_60px_-30px_rgba(0,0,0,.85)] transition-transform duration-500 hover:rotate-0">
            <div className="rounded-lg border border-ink/15 p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3 border-b border-ink/15 pb-4"><div><p className="smallcaps text-gold-dark">ডিজিটাল মাপ কার্ড</p><h2 className="mt-1 text-[22px] font-semibold">{asText(card.name)}</h2><p className="mt-1 text-sm text-ink-3">{asText(card.profile)}</p></div><span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-medium">{asText(card.version)}</span></div>
              <div className="mt-4 flex justify-between text-xs text-ink-3"><span>শেষ আপডেট</span><span className="num">{asText(card.date)}</span></div>
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{measurements.map((item, index) => <div key={index} className="rounded-md border border-ink/10 bg-white/70 p-3"><dt className="text-xs text-ink-3">{asText(item.label)}</dt><dd className="num mt-1 text-[19px] font-semibold">{asText(item.value)}</dd><dd className="num text-xs text-gold-dark">{asText(item.change)}</dd></div>)}</dl>
              {asText(card.note) && <p className="mt-4 rounded-md bg-gold/15 px-3 py-2 text-xs text-ink-3">{asText(card.note)}</p>}
              {asText(card.brand) && <p className="mt-4 text-right smallcaps text-stone">{asText(card.brand)}</p>}
            </div>
          </div>
        </div>}
      </div>
    </section>
  );
}
