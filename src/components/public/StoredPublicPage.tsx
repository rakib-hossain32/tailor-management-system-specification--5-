import { getPublicSiteSnapshot } from "@/server/cms/service";
import { SectionHead } from "@/components/public/PublicPage";
import { ContentSections } from "@/components/public/ContentSections";

export async function StoredPublicPage({ slug, title }: { slug: string; title: string }) {
  const snapshot = await getPublicSiteSnapshot();
  const page = snapshot.pages[slug];
  return <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6"><SectionHead eyebrow={title} title={page?.title || title} sub={page?.intro || undefined} />{page?.sections.length ? <ContentSections sections={page.sections} /> : <p className="paper-card p-6 text-ink-3">এই পাতায় এখনো কোনো তথ্য প্রকাশ করা হয়নি।</p>}</section>;
}
