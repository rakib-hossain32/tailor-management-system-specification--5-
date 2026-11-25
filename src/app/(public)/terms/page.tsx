import { StoredPublicPage } from "@/components/public/StoredPublicPage";
import { publicPageMetadata } from "@/lib/public-page";
export async function generateMetadata() { return publicPageMetadata("terms"); }
export default function Page() { return <StoredPublicPage slug="terms" title="শর্তাবলি" />; }
