import { HomePageContent } from "@/components/public/HomePageContent";
import { publicPageMetadata } from "@/lib/public-page";
import { getPublicSiteSnapshot } from "@/server/cms/service";

export async function generateMetadata() {
  return publicPageMetadata("home");
}

export default async function HomePage() {
  const snapshot = await getPublicSiteSnapshot();
  return <HomePageContent snapshot={snapshot} />;
}
