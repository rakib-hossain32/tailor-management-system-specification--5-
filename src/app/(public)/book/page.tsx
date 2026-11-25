import { BookForm } from "@/components/BookForm";
import { ShopContactLine } from "@/components/ShopBrand";
import { SectionHead } from "@/components/public/PublicPage";
import { getPublicSiteSnapshot } from "@/server/cms/service";
export const metadata = { title: "অ্যাপয়েন্টমেন্ট" };
export default async function BookPage() {
  const snapshot = await getPublicSiteSnapshot();
  // Active garments are managed in Admin Panel → ব্যবস্থাপনা → পোশাক ও মাপ.
  // Whatever the admin adds and activates there is what visitors can pick here.
  const garments = snapshot.garments.map((g) => ({ id: g.id, nameBn: g.nameBn }));
  return (
    <section className="mx-auto w-full max-w-[900px] px-3 py-8 sm:px-6 sm:py-12">
      <SectionHead eyebrow="অ্যাপয়েন্টমেন্ট" title="আসার সময় বেছে নিন" sub="তারিখ ও সময় একসাথে বেছে নিন, কী বানাতে চান তা জানান — বাকিটা আমরা দেখছি।" />
      <BookForm garments={garments} />
      <p className="mt-6 text-ink-3">যোগাযোগ: <ShopContactLine className="text-gold-dark" /></p>
    </section>
  );
}
