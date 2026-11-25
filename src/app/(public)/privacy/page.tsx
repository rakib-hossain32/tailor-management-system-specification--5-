import { StoredPublicPage } from "@/components/public/StoredPublicPage";
import { publicPageMetadata } from "@/lib/public-page";
export async function generateMetadata() { return publicPageMetadata("privacy"); }
export default function Page() { return <StoredPublicPage slug="privacy" title="গোপনীয়তা" />; }
