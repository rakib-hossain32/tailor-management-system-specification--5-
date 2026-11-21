import { PublicPage, SectionHead } from "@/components/public/PublicPage";
import { BookForm } from "@/components/BookForm";

export const metadata = { title: "অ্যাপয়েন্টমেন্ট" };

const BENEFITS = [
  ["৩০ মিনিটের স্লট", "ভিড় এড়িয়ে সময়মতো মাপ দেওয়া যায়।"],
  ["নিশ্চিতকরণ SMS", "বুকিং হলে তারিখ, সময় ও উদ্দেশ্যসহ বার্তা যায়।"],
  ["হোম ভিজিট", "বিয়ে/বড় অর্ডারে মাস্টার আপনার কাছে যেতে পারেন।"],
  ["পুনঃনির্ধারণ", "দরকার হলে ফোন করে সময় বদলানো সম্ভব।"],
];

export default function BookPage() {
  return (
    <PublicPage>
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
        <SectionHead
          eyebrow="অ্যাপয়েন্টমেন্ট"
          title="মাপ দিতে আসার সময় বেছে নিন"
          sub="তারিখ ও সময় দিলে স্লট সংরক্ষিত হবে। প্রয়োজনে ফোনেও বুক করা যায় — ০১৭১১-০০০০০১।"
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <BookForm />

          <div className="space-y-4">
            {BENEFITS.map(([t, d]) => (
              <div key={t} className="paper-card p-5">
                <h2 className="text-[19px]">{t}</h2>
                <p className="mt-1 text-[15px] text-ink-3">{d}</p>
              </div>
            ))}
            <div className="paper-card p-5">
              <h2 className="text-[19px]">আসার আগে</h2>
              <ul className="mt-2 space-y-1.5 text-[15px] text-ink-3">
                <li>• ভালো-ফিট একটি পোশাক এনে দিলে রেফারেন্স হিসেবে কাজে লাগে</li>
                <li>• পুরনো অর্ডারের ইনভয়েস থাকলে আনুন</li>
                <li>• কাপড় নিজের আনবেন জানালে রসিদসহ রেকর্ড হবে</li>
                <li>• ট্রায়ালের জন্য আসলে আগের পোশাকটি সঙ্গে আনুন</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
