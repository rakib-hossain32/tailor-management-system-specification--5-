import Image from "next/image";
import Link from "next/link";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { publicPageMetadata } from "@/lib/public-page";
import { SectionHead } from "@/components/public/PublicPage";
import { ContentSections } from "@/components/public/ContentSections";
import { ServiceCards } from "@/components/public/home/HomeServices";
import { Button } from "@/components/ui/button";
import { taka } from "@/lib/format";

export async function generateMetadata() { return publicPageMetadata("services"); }

export default async function ServicesPage() {
  const snapshot = await getPublicSiteSnapshot();
  const page = snapshot.pages.services;
  const editorialServices = page?.sections.filter((section) => section.kind === "service") ?? [];
  const details = page?.sections.filter((section) => section.kind !== "service" && section.data.sectionKey !== "offerings") ?? [];
  const offeringsHeading = page?.sections.find((section) => section.data.sectionKey === "offerings");

  return <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6">
    <SectionHead eyebrow="সার্ভিস" title={page?.title || "সার্ভিস ও মূল্য"} sub={page?.intro || undefined} />
    {editorialServices.length > 0 ? <>
      {offeringsHeading && <div className="mb-6"><div className="smallcaps text-gold-dark">{offeringsHeading.label}</div><h2 className="mt-2 text-[30px] leading-tight sm:text-[36px]">{offeringsHeading.heading}</h2><p className="mt-2 max-w-3xl text-ink-3">{offeringsHeading.body}</p></div>}
      <ServiceCards sections={editorialServices} />
    </> : <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{snapshot.garments.map((garment) => <article key={garment.id} className="paper-card flex flex-col overflow-hidden">{garment.imageUrl && <Image src={garment.imageUrl} width={1000} height={700} sizes="(max-width: 768px) 100vw, 33vw" alt={garment.nameBn} className="h-56 w-full object-cover" />}<div className="flex flex-1 flex-col p-6"><h2 className="text-[25px]">{garment.nameBn}</h2>{garment.nameEn && <p className="smallcaps mt-1 text-gold-dark">{garment.nameEn}</p>}{garment.summary && <p className="mt-4 whitespace-pre-line text-[15.5px] leading-relaxed text-ink-3">{garment.summary}</p>}{garment.features.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-3">{garment.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>}<div className="mt-6 flex-1" /><dl className="mt-4 space-y-2 border-t border-ink/10 pt-4"><div className="flex justify-between"><dt className="text-sm text-ink-3">মূল্য</dt><dd className="num text-xl font-semibold">{taka(garment.basePrice)}</dd></div><div className="flex justify-between text-sm"><dt className="text-ink-3">সাধারণ ডেলিভারি</dt><dd className="num">{garment.defaultDeliveryDays} দিন</dd></div></dl><Button asChild variant="gold" className="mt-5"><Link href="/book">অ্যাপয়েন্টমেন্ট নিন</Link></Button></div></article>)}</div>}
    {!editorialServices.length && snapshot.garments.length === 0 && <p className="paper-card p-6 text-ink-3">এখনো কোনো সার্ভিস প্রকাশ করা হয়নি।</p>}
    {details.length > 0 && <div className="mt-12"><ContentSections sections={details} /></div>}
  </section>;
}
