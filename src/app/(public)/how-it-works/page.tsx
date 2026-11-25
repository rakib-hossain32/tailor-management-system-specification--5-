import { StoredPublicPage } from "@/components/public/StoredPublicPage";
import { publicPageMetadata } from "@/lib/public-page";
export async function generateMetadata() { return publicPageMetadata("how-it-works"); }
export default function Page() { return <StoredPublicPage slug="how-it-works" title="কীভাবে কাজ করে" />; }
