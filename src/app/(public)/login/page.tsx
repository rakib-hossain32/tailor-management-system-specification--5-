import Link from "next/link";
import Image from "next/image";
import { PublicPage } from "@/components/public/PublicPage";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "কাস্টমার লগইন" };

export default function LoginPage() {
  return (
    <PublicPage>
      <section className="mx-auto grid max-w-[1100px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-20">
        <div className="relative overflow-hidden border border-envelope">
          <Image
            src="/images/hanging-garments.jpg"
            width={1000}
            height={1200}
            sizes="(max-width: 1024px) 100vw, 50vw"
            alt="দোকানের দরজায় ঝুলন্ত পাঞ্জাবি"
            className="h-full min-h-[280px] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-paper">
            <div className="smallcaps text-gold">কাস্টমার পোর্টাল</div>
            <h1 className="mt-2 text-[32px] leading-tight sm:text-[38px]">
              আপনার মাপ ও অর্ডার — এক জায়গায়
            </h1>
            <ul className="mt-3 space-y-1.5 text-[15.5px] text-paper/85">
              <li>• পোশাকভিত্তিক সর্বশেষ মাপ ও সংস্করণ ইতিহাস (রিড-অনলি)</li>
              <li>• সব অর্ডার, ইনভয়েস ও বকেয়ার হিসাব</li>
              <li>• পরবর্তী অ্যাপয়েন্টমেন্ট ও ডেলিভারি তারিখ</li>
            </ul>
          </div>
        </div>

        <div className="paper-card p-6 sm:p-8">
          <div className="smallcaps text-stone">ফোন + OTP</div>
          <h2 className="mt-1.5 text-[30px]">লগইন করুন</h2>
          <p className="mt-2 text-[15.5px] text-ink-3">
            অর্ডার দেওয়া ফোন নম্বরটি দিন। ৬ সংখ্যার কোড SMS-এ যাবে এবং ৫ মিনিট কার্যকর।
          </p>

          <div className="mt-5">
            <LoginForm />
          </div>

          <div className="mt-6 border-t border-dashed border-stone/50 pt-4 text-[15px] text-ink-3">
            অ্যাকাউন্ট নেই? দোকানে অর্ডার দিলেই তৈরি হয়। জরুরি হলে{" "}
            <Link href="/contact" className="chalk-link text-gold-dark">
              যোগাযোগ করুন
            </Link>
            ।
          </div>

          <Link href="/track" className="chalk-link mt-3 inline-block text-[15px] text-gold-dark">
            লগইন ছাড়াই অর্ডার ট্র্যাক করুন →
          </Link>
        </div>
      </section>
    </PublicPage>
  );
}
