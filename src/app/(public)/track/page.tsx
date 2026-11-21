import Link from "next/link";
import { PublicPage, SectionHead } from "@/components/public/PublicPage";
import { TrackForm } from "@/components/TrackForm";

export const metadata = { title: "অর্ডার ট্র্যাকিং" };

const HINTS = [
  ["অর্ডার নম্বর কোথায়?", "ক্যাশ মেমোর উপরে থাকে, যেমন TP-2611-0042। SMS-এও একই নম্বর যায়।"],
  ["ফোন নম্বর?", "অর্ডার দেওয়া ফোন নম্বরটিই দিতে হবে (01XXXXXXXXX)।"],
  ["লগইন লাগবে?", "না। এই পাতায় শুধু অবস্থা, ডেলিভারি তারিখ ও বকেয়া দেখা যায় — মাপ বা ঠিকানা নয়।"],
  ["মাপ দেখতে চাইলে?", "পোর্টালে ফোন নম্বরে OTP দিয়ে লগইন করুন — সেখানে নিজের মাপ ও অর্ডারের ইতিহাস থাকে।"],
];

export default function TrackPage() {
  return (
    <PublicPage>
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
        <SectionHead
          eyebrow="অর্ডার ট্র্যাকিং"
          title="“আমার জামা হয়েছে কি?” — এখনই দেখুন"
          sub="ফোন নম্বর ও অর্ডার নম্বর দিন। লগইন লাগবে না, কোনো ব্যক্তিগত তথ্য দেখানো হবে না।"
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TrackForm />

          <div className="space-y-4">
            {HINTS.map(([q, a]) => (
              <div key={q} className="paper-card p-5">
                <h2 className="text-[18px]">{q}</h2>
                <p className="mt-1.5 text-[15px] text-ink-3">{a}</p>
              </div>
            ))}
            <div className="paper-card p-5">
              <h2 className="text-[18px]">লগইন করে আরও কী</h2>
              <ul className="mt-2 space-y-1.5 text-[15px] text-ink-3">
                <li>• নিজের ও পারিবারিক সব মাপ (রিড-অনলি)</li>
                <li>• অর্ডারের সম্পূর্ণ ইতিহাস ও ইনভয়েস</li>
                <li>• রি-অর্ডার ও মাপ সংশোধনের অনুরোধ</li>
              </ul>
              <Link href="/login" className="chalk-link mt-3 inline-block font-medium text-gold-dark">
                পোর্টালে প্রবেশ করুন →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
