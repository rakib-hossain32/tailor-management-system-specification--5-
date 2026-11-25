import "server-only";
import { getPublicSiteSnapshot } from "@/server/cms/service";

export async function publicPageMetadata(slug: string) {
  const snapshot = await getPublicSiteSnapshot();
  const page = snapshot.pages[slug];
  return { title: page?.seoTitle || page?.title || snapshot.shop.nameBn, description: page?.seoDescription || page?.intro || snapshot.shop.tagline || undefined };
}
