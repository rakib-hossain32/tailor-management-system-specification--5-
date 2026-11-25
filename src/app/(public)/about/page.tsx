import Image from "next/image";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { publicPageMetadata } from "@/lib/public-page";
import { SectionHead } from "@/components/public/PublicPage";
import { ContentSections } from "@/components/public/ContentSections";

export async function generateMetadata() { return publicPageMetadata("about"); }
export default async function AboutPage() {
  const snapshot = await getPublicSiteSnapshot();
  const page = snapshot.pages.about;
  return <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6"><div className="mb-10 grid items-center gap-8 lg:grid-cols-2"><SectionHead eyebrow="আমাদের সম্পর্কে" title={page?.title || snapshot.shop.nameBn || "আমাদের সম্পর্কে"} sub={page?.intro || undefined} />{snapshot.shop.aboutUrl && <Image src={snapshot.shop.aboutUrl} width={1536} height={1024} alt={page?.title || snapshot.shop.nameBn || ""} loading="eager" sizes="(max-width: 1024px) 100vw, 50vw" className="h-[360px] w-full rounded-xl object-cover" />}</div>{page?.sections.length ? <ContentSections sections={page.sections} /> : <p className="paper-card p-6 text-ink-3">এই পাতায় এখনো কোনো তথ্য প্রকাশ করা হয়নি।</p>}</section>;
}