import Link from "next/link";
import Image from "next/image";
import { PublicPage, SectionHead } from "@/components/public/PublicPage";

export const metadata = { title: "কীভাবে কাজ করে" };

const STEPS = [
  {
    n: "০১",
    t: "অ্যাপয়েন্টমেন্ট",
    d: "ফোনে বা ওয়েবসাইট থেকে সময় বেছে নিন। প্রতি স্লট ৩০ মিনিট — অপেক্ষা করতে হয় না। উদ্দেশ্য জানান: নতুন মাপ, ট্রায়াল, ডেলিভারি বা পরামর্শ।",
  },
  {
    n: "০২",
    t: "মাপ গ্রহণ",
    d: "মাস্টার টেপ দিয়ে মাপ নেন এবং সঙ্গে সঙ্গে ট্যাবলেটে লেখেন। পুরনো মাপ থাকলে পাশে দেখিয়ে পার্থক্য হাইলাইট হয়। মাপ কখনো মুছে ফেলা হয় না — প্রতিবার নতুন সংস্করণ তৈরি হয়।",
  },
  {
    n: "০৩",
    t: "অর্ডার ও অ্যাডভান্স",
    d: "পোশাক, কাপড়, স্টাইল অপশন, ডেলিভারি তারিখ ও মূল্য নিশ্চিত হয়। অ্যাডভান্স দিলে ক্যাশ মেমো ও অর্ডার নম্বরসহ SMS যায়।",
  },
  {
    n: "০৪",
    t: "কাটিং → সেলাই → ফিনিশিং",
    d: "প্রতিটি ধাপে কারিগর স্ট্যাটাস আপডেট করেন, তাই আপনি ট্র্যাকিং পাতায় দেখতে পান কোন ধাপে পোশাক আছে।",
  },
  {
    n: "০৫",
    t: "ট্রায়াল (প্রয়োজনে)",
    d: "সেলাইয়ের পর ফিট দেখতে ডাকা হয়। ঠিক না হলে সংশোধন নোট থেকে মাপের নতুন ভার্সন তৈরি হয় — কাপড় নষ্ট হয় না।",
  },
  {
    n: "০৬",
    t: "ডেলিভারি",
    d: "রেডি হলে SMS। বকেয়া পরিশোধ করে পোশাক নিন, সঙ্গে ইনভয়েস ও মাপের কপি।",
  },
];

const POLICY = [
  {
    t: "মাপ কেন দোকানে নেওয়া হয়",
    d: "ভঙ্গি, কাঁধের ঢাল ও পেটের আকৃতি দেখে মাপ ঠিক করার অভিজ্ঞতা মানুষের। নিজে নিজে মাপলে ভুলের হার বেশি, আর ভুল মাপ মানে নষ্ট কাপড়। তাই মাপ নেবে মানুষ, সংরক্ষণ করবে সিস্টেম।",
  },
  {
    t: "দূরে থাকলে",
    d: "ভিডিও কলে মাস্টার গাইড করবেন, অথবা ভালো-ফিট একটি পোশাক নিয়ে এলে সেটি মেপে নেওয়া হয়। এই মাপ যাচাই না হওয়া পর্যন্ত “অযাচাইকৃত” হিসেবে চিহ্নিত থাকে।",
  },
  {
    t: "ট্রায়াল ও সংশোধন",
    d: "ট্রায়ালে ফিট ঠিক না হলে ৭ দিনের মধ্যে সংশোধন ফ্রি। সংশোধনের পরিবর্তন মাপের নতুন ভার্সন হিসেবে সংরক্ষিত হয়, পরের অর্ডারে সেটিই কাজে লাগে।",
  },
  {
    t: "বকেয়া ও ডেলিভারি",
    d: "ডেলিভারির আগে বকেয়া শূন্য করতে হয়। বিশেষ পরিস্থিতিতে মালিকের অনুমোদনে “বকেয়া সহ ডেলিভারি” সম্ভব, যা লগে থাকে।",
  },
];

const FAQ = [
  ["মাপ কি অনলাইনে দিতে পারি?", "না। মাপ দোকানে মাস্টার নেন — এটাই ভুলমুক্ত ফিটের নিশ্চয়তা। অনলাইনে আপনি শুধু অ্যাপয়েন্টমেন্ট বুক, মাপ দেখা ও অর্ডার ট্র্যাক করতে পারবেন।"],
  ["পুরনো মাপ কি আবার নিতে হবে?", "না। মাপ একবার সংরক্ষিত হলে পরের অর্ডারে স্বয়ংক্রিয়ভাবে লোড হয়। ১ বছার বেশি পুরনো হলে আবার মাপার পরামর্শ দেখানো হয়।"],
  ["কাস্টমারের নিজের কাপড় দিলে?", "হ্যাঁ। কাপড় গ্রহণ রসিদসহ রেকর্ড হয়, অর্ডারে “কাস্টমারের কাপড়” হিসেবে চিহ্নিত থাকে এবং স্টক থেকে কাটা হয় না।"],
  ["কত দিনে পাব?", "সাধারণত শার্ট ৪ দিন, পাঞ্জাবি ৭ দিন, কামিজ ৮ দিন। ঈদ বা বিয়ের মৌসুমে আগে বুকিং নেওয়া হয় — ক্যাপাসিটি পূর্ণ হলে পরের সম্ভব তারিখ জানানো হয়।"],
  ["মূল্য কীভাবে নির্ধারিত হয়?", "পোশাকের ধরন + কাজের জটিলতা (কাজ, এমব্রয়ডারি, লাইনিং) + কাপড়। মূল্য অর্ডার নিশ্চিত করার আগেই লিখিতভাবে জানানো হয়।"],
];

export default function HowItWorksPage() {
  return (
    <PublicPage>
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
        <SectionHead
          eyebrow="প্রক্রিয়া"
          title="অ্যাপয়েন্টমেন্ট থেকে ডেলিভারি — ছয় ধাপ"
          sub="প্রতিটি ধাপে কী হয়, কে দায়ী এবং আপনি কী দেখবেন — স্পষ্টভাবে।"
        />

        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="paper-card relative overflow-hidden p-5">
              <span className="num absolute -top-1 right-3 text-[56px] leading-none font-semibold text-gold/25" aria-hidden>
                {s.n}
              </span>
              <h2 className="relative text-[21px]">{s.t}</h2>
              <p className="relative mt-2 text-[15px] text-ink-3">{s.d}</p>
              <span aria-hidden className="ticks-h absolute inset-x-0 bottom-0 h-2.5 opacity-45" />
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-ink/10 bg-paper-2/70">
        <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <figure className="overflow-hidden border border-envelope">
              <Image src="/images/trial-fitting.jpg" width={1000} height={1200} sizes="(max-width: 1024px) 100vw, 45vw" alt="ট্রায়ালে ফিট যাচাই" className="h-full w-full object-cover" loading="lazy" />
            </figure>
            <div className="space-y-5">
              <h2 className="text-[30px] sm:text-[36px]">নীতিমালা, সংক্ষেপে</h2>
              {POLICY.map((p) => (
                <article key={p.t} className="border-l-2 border-gold pl-4">
                  <h3 className="text-[19px]">{p.t}</h3>
                  <p className="mt-1 text-[15.5px] text-ink-2">{p.d}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[900px] px-4 py-12 sm:px-6">
        <h2 className="text-[30px] sm:text-[38px]">সাধারণ প্রশ্ন</h2>
        <dl className="mt-6 space-y-4">
          {FAQ.map(([q, a]) => (
            <div key={q} className="paper-card p-5">
              <dt className="text-[18px] font-medium">{q}</dt>
              <dd className="mt-1.5 text-[15.5px] text-ink-3">{a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/book" className="rounded-sm bg-ink px-6 py-3.5 text-[16px] text-paper hover:bg-ink-2">
            অ্যাপয়েন্টমেন্ট নিন
          </Link>
          <Link href="/services" className="rounded-sm border border-ink/30 px-6 py-3.5 text-[16px] hover:bg-ink/5">
            সার্ভিস ও মূল্য
          </Link>
        </div>
      </section>
    </PublicPage>
  );
}
