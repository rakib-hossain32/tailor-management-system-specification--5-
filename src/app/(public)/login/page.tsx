import Image from "next/image";
import { getPublicSiteSnapshot } from "@/server/cms/service";
import { LoginForm } from "@/components/LoginForm";
export const metadata = { title: "কাস্টমার লগইন" };
export default async function LoginPage() {
  const { shop } = await getPublicSiteSnapshot();
  return <section className="mx-auto grid max-w-[1100px] items-start gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2"><div><h1 className="mb-5 text-[34px]">{shop.nameBn || shop.nameEn}</h1>{shop.heroUrl && <Image src={shop.heroUrl} width={1536} height={1024} alt={shop.nameBn} loading="eager" sizes="(max-width: 1024px) 100vw, 50vw" className="h-80 w-full rounded-xl object-cover" />}</div><div className="paper-card p-6 sm:p-8"><h2 className="text-[30px]">কাস্টমার লগইন</h2><p className="mt-3 mb-6 text-ink-3">আপনার অ্যাকাউন্টের ফোন নম্বর দিয়ে লগইন কোডের অনুরোধ করুন।</p><LoginForm /></div></section>;
}