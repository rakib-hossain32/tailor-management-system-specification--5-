import { requireAdminPage } from "@/lib/page-auth";
import { getAdminSiteContent } from "@/server/cms/admin";
import { ContentManager } from "@/components/admin/ContentManager";
import { PageHead } from "@/components/admin/PageHead";

export default async function ContentPage() {
  const actor = await requireAdminPage(true);
  const state = await getAdminSiteContent(actor);
  return <div className="space-y-6"><PageHead eyebrow="সাইট ব্যবস্থাপনা" title="ওয়েবসাইটের তথ্য ও ছবি" sub="দোকানের পরিচয়, সময়, পাতার লেখা, সার্ভিস ও ছবি এখান থেকে পরিবর্তন করুন।" /><ContentManager initial={state} /></div>;
}
