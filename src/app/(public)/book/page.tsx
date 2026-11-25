import { BookForm } from "@/components/BookForm";
import { ShopContactLine } from "@/components/ShopBrand";
import { SectionHead } from "@/components/public/PublicPage";
export const metadata = { title: "অ্যাপয়েন্টমেন্ট" };
export default function BookPage() { return <section className="mx-auto max-w-[900px] px-4 py-12 sm:px-6"><SectionHead eyebrow="অ্যাপয়েন্টমেন্ট" title="আসার সময় বেছে নিন" sub="তারিখ, উপলভ্য সময় ও আপনার তথ্য দিয়ে অ্যাপয়েন্টমেন্টের অনুরোধ করুন।" /><BookForm /><p className="mt-6 text-ink-3">যোগাযোগ: <ShopContactLine className="text-gold-dark" /></p></section>; }