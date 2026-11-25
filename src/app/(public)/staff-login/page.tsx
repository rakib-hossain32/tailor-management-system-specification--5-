import Link from "next/link";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { StaffLoginForm } from "@/components/StaffLoginForm";
import { ShopLogo } from "@/components/ShopBrand";

export const metadata = { title: "স্টাফ লগইন" };
export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ shop }, { error }] = await Promise.all([getPublicSiteSnapshot(), searchParams]);
  return <section className="mx-auto grid max-w-[1000px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2"><div className="dark-luxury-card p-7"><div className="flex items-center gap-3 text-gold"><ShopLogo size={32} /><h1 className="text-[28px] text-white">{shop.nameBn || shop.nameEn}</h1></div><h2 className="mt-7 text-[32px] text-white">স্টাফ লগইন</h2><p className="mt-4 text-paper/75">দোকান থেকে দেওয়া অ্যাকাউন্ট দিয়ে লগইন করুন। কাজ ও অনুমতি অনুযায়ী আপনার পাতা খুলবে।</p>{shop.phone && <a href={`tel:${shop.phone}`} className="mt-6 block text-gold">{shop.phone}</a>}</div><div className="paper-card p-6 sm:p-8"><h2 className="mb-5 text-[28px]">লগইন করুন</h2><StaffLoginForm initialError={error} /><div className="mt-6 flex flex-wrap gap-4 text-sm text-gold-dark"><Link href="/">ওয়েবসাইট</Link><Link href="/login">কাস্টমার লগইন</Link></div></div></section>;
}