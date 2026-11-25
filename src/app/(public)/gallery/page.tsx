import Link from "next/link";
import Image from "next/image";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { publicPageMetadata } from "@/lib/public-page";
import { SectionHead } from "@/components/public/PublicPage";

export async function generateMetadata() { return publicPageMetadata("gallery"); }
export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [snapshot, search] = await Promise.all([getPublicSiteSnapshot(), searchParams]);
  const page = snapshot.pages.gallery;
  const categories = [...new Set(snapshot.gallery.map((item) => item.category).filter(Boolean))];
  const items = search.category ? snapshot.gallery.filter((item) => item.category === search.category) : snapshot.gallery;
  return <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6"><SectionHead eyebrow="গ্যালারি" title={page?.title || "গ্যালারি"} sub={page?.intro || undefined} />{categories.length > 0 && <nav className="mb-8 flex flex-wrap gap-2" aria-label="গ্যালারি বিভাগ"><Link href="/gallery" className={`rounded-full border px-4 py-2 text-sm ${!search.category ? "bg-ink text-paper" : "border-ink/25"}`}>সব</Link>{categories.map((category) => <Link key={category} href={`/gallery?category=${encodeURIComponent(category)}`} className={`rounded-full border px-4 py-2 text-sm ${search.category === category ? "bg-ink text-paper" : "border-ink/25"}`}>{category}</Link>)}</nav>}<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.map((item, index) => <figure key={item.id} className="paper-card overflow-hidden">{item.imageUrl && <Image src={item.imageUrl} alt={item.title} width={1200} height={800} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" loading={index === 0 ? "eager" : "lazy"} className="h-64 w-full object-cover" />}<figcaption className="p-5">{item.category && <div className="smallcaps mb-2 text-gold-dark">{item.category}</div>}<h2 className="text-[23px]">{item.title}</h2>{item.caption && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-3">{item.caption}</p>}</figcaption></figure>)}</div>{items.length === 0 && <p className="paper-card p-6 text-ink-3">এই বিভাগে এখনো কোনো ছবি প্রকাশ করা হয়নি।</p>}</section>;
}