import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarCheck, SearchCheck } from "lucide-react";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { publicPageMetadata } from "@/lib/public-page";
import { ContentSections } from "@/components/public/ContentSections";
import { TrackForm } from "@/components/TrackForm";
import { Button } from "@/components/ui/button";
import { taka } from "@/lib/format";

export async function generateMetadata() { return publicPageMetadata("home"); }
export default async function HomePage() {
  const snapshot = await getPublicSiteSnapshot();
  const { shop, stats } = snapshot;
  const page = snapshot.pages.home;
  const hero = page?.sections.find((section) => section.kind === "hero");
  const image = hero?.imageUrl || shop.heroUrl;
  const services = snapshot.garments.filter((garment) => garment.featured);
  const sections = page?.sections.filter((section) => section.kind !== "hero") ?? [];
  return <>
    <section className="relative overflow-hidden bg-ink text-paper">
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        <div><div className="smallcaps text-gold">{hero?.label || shop.nameEn || shop.nameBn}</div><h1 className="mt-4 font-display text-[40px] leading-[1.12] sm:text-[58px]">{hero?.heading || page?.title || shop.nameBn || shop.nameEn}</h1>{(hero?.body || page?.intro || shop.tagline) && <p className="mt-6 max-w-xl whitespace-pre-line text-[17px] leading-relaxed text-paper/80">{hero?.body || page?.intro || shop.tagline}</p>}<div className="mt-8 flex flex-wrap gap-3"><Button asChild variant="gold" size="lg"><Link href="/book"><CalendarCheck className="size-4" />অ্যাপয়েন্টমেন্ট নিন</Link></Button><Button asChild variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20"><Link href="/track"><SearchCheck className="size-4" />অর্ডার ট্র্যাক করুন</Link></Button></div>{shop.address && <p className="mt-7 whitespace-pre-line text-sm text-paper/65">{shop.address}</p>}</div>
        {image && <div className="overflow-hidden rounded-2xl border border-gold/30 shadow-2xl"><Image src={image} width={1536} height={1024} alt={hero?.heading || shop.nameBn || ""} loading="eager" sizes="(max-width: 1024px) 100vw, 50vw" className="h-[320px] w-full object-cover sm:h-[420px]" /></div>}
      </div>
    </section>
    <div className="border-b border-ink/10 bg-gold"><div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-6 px-4 py-7 sm:px-6 lg:grid-cols-4">{[["কাস্টমার", stats.customers], ["সংরক্ষিত মাপ", stats.measurements], ["ডেলিভারি সম্পন্ন", stats.deliveredOrders], ["কারিগর", stats.workers]].map(([label, value]) => <div key={label as string}><div className="num text-[30px] font-semibold">{Number(value).toLocaleString("en-US")}</div><div className="mt-1 text-sm">{label as string}</div></div>)}</div></div>
    <section className="mx-auto grid max-w-[1280px] items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2"><div><div className="smallcaps text-gold-dark">অর্ডারের অগ্রগতি</div><h2 className="mt-3 text-[34px] leading-tight">আপনার অর্ডার কোথায় আছে?</h2><p className="mt-4 text-ink-3">অর্ডারের মোবাইল নম্বর ও অর্ডার নম্বর দিয়ে বর্তমান অবস্থা দেখুন।</p></div><TrackForm compact /></section>
    {services.length > 0 && <section className="border-y border-ink/10 bg-paper-2/60"><div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><h2 className="text-[34px]">সার্ভিস ও মূল্য</h2><Link href="/services" className="inline-flex items-center gap-2 text-gold-dark">সব সার্ভিস দেখুন<ArrowRight className="size-4" /></Link></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{services.map((garment) => <article key={garment.id} className="paper-card overflow-hidden">{garment.imageUrl && <Image src={garment.imageUrl} width={1000} height={700} sizes="(max-width: 768px) 100vw, 33vw" alt={garment.nameBn} className="h-48 w-full object-cover" />}<div className="p-6"><h3 className="text-[25px]">{garment.nameBn}</h3>{garment.summary && <p className="mt-3 text-[15px] leading-relaxed text-ink-3">{garment.summary}</p>}<div className="mt-5 flex items-center justify-between gap-3"><span className="num text-xl font-medium">{taka(garment.basePrice)}</span><Button asChild variant="outline"><Link href="/book">অ্যাপয়েন্টমেন্ট</Link></Button></div></div></article>)}</div></div></section>}
    {sections.length > 0 && <section className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6"><ContentSections sections={sections} /></section>}
  </>;
}