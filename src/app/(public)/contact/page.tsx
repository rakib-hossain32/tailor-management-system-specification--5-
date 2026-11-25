import Link from "next/link";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { publicPageMetadata } from "@/lib/public-page";
import { SectionHead } from "@/components/public/PublicPage";
import { ContentSections } from "@/components/public/ContentSections";
import { Button } from "@/components/ui/button";

export async function generateMetadata() { return publicPageMetadata("contact"); }
export default async function ContactPage() {
  const snapshot = await getPublicSiteSnapshot();
  const { shop } = snapshot;
  const page = snapshot.pages.contact;
  const channels = [{ label: "ফোন", value: shop.phone, href: shop.phone ? `tel:${shop.phone}` : null }, { label: "ইমেইল", value: shop.email, href: shop.email ? `mailto:${shop.email}` : null }, { label: "WhatsApp", value: shop.whatsapp, href: shop.whatsapp ? `https://wa.me/${shop.whatsapp.replace(/\D/g, "")}` : null }, { label: "ফেসবুক", value: shop.facebookUrl, href: shop.facebookUrl }].filter((channel) => channel.value && channel.href);
  return <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6"><SectionHead eyebrow="যোগাযোগ" title={page?.title || "যোগাযোগ"} sub={page?.intro || undefined} /><div className="mb-10 grid gap-6 lg:grid-cols-2"><div className="paper-card p-6 sm:p-8"><h2 className="text-[28px]">{shop.nameBn || shop.nameEn}</h2>{shop.address && <address className="mt-4 whitespace-pre-line text-[17px] not-italic leading-relaxed text-ink-3">{shop.address}</address>}<div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="gold"><Link href="/book">অ্যাপয়েন্টমেন্ট নিন</Link></Button>{shop.address && <Button asChild variant="outline"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`} target="_blank" rel="noreferrer">ম্যাপে দেখুন</a></Button>}</div></div><div className="grid gap-4">{channels.map((channel) => <a key={channel.label} href={channel.href!} className="paper-card block min-w-0 p-5"><div className="smallcaps text-gold-dark">{channel.label}</div><div className="mt-2 break-all text-[20px]">{channel.value}</div></a>)}</div></div>{page?.sections.length ? <ContentSections sections={page.sections} /> : null}</section>;
}