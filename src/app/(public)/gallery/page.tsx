import Link from "next/link";
import Image from "next/image";
import { PublicPage, SectionHead } from "@/components/public/PublicPage";

export const metadata = { title: "গ্যালারি" };

const SHOTS = [
  {
    src: "/images/hanging-garments.jpg",
    cat: "পাঞ্জাবি",
    title: "ঈদের সংগ্রহ — ব্যান্ড কলার পাঞ্জাবি",
    note: "১২টি অর্ডার, একই ডিজাইন, আলাদা আলাদা মাপ",
  },
  {
    src: "/images/trial-fitting.jpg",
    cat: "ট্রায়াল",
    title: "ট্রায়ালে ফিট যাচাই",
    note: "কাঁধের ফিট ঠিক করে মাপের নতুন ভার্সন (fit_adjusted)",
  },
  {
    src: "/images/sewing-machine.jpg",
    cat: "কাজ",
    title: "সেলাইয়ের কাজ",
    note: "প্রতিটি ধাপে কারিগর স্ট্যাটাস আপডেট করেন",
  },
  {
    src: "/images/fabric-stack.jpg",
    cat: "কাপড়",
    title: "মৌসুমি কাপড়ের সংগ্রহ",
    note: "সুতি, খাদি, লিনেন ও সিল্ক — প্রতি গজের হিসাবসহ",
  },
  {
    src: "/images/chalk-tools.jpg",
    cat: "কাটিং",
    title: "কাটিং টেবিল",
    note: "চক, কাঁচি ও প্যাটার্ন — মাপ কাটার আগে দ্বিতীয়বার যাচাই",
  },
  {
    src: "/images/hero-cutting-table.jpg",
    cat: "মাপ",
    title: "মাপ নেওয়া ও এন্ট্রি",
    note: "মাস্টার মাপ নেন, রিসেপশনিস্ট সঙ্গে সঙ্গে সিস্টেমে লেখেন",
  },
];

const CATS = ["সব", "পাঞ্জাবি", "ট্রায়াল", "কাজ", "কাপড়", "কাটিং", "মাপ"];

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat = "সব" } = await searchParams;
  const list = cat === "সব" ? SHOTS : SHOTS.filter((s) => s.cat === cat);

  return (
    <PublicPage>
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
        <SectionHead
          eyebrow="গ্যালারি"
          title="কাজের ছবি"
          sub="দোকানের কাজ, কাপড় ও ট্রায়ালের মুহূর্ত — যা দিয়ে প্রতিদিন ব্যবসা চলে।"
        />

        <nav className="mb-7 flex flex-wrap gap-2">
          {CATS.map((c) => (
            <Link
              key={c}
              href={c === "সব" ? "/gallery" : `/gallery?cat=${encodeURIComponent(c)}`}
              className={`rounded-full border px-4 py-1.5 text-[14.5px] transition-colors ${
                cat === c ? "border-ink bg-ink text-paper" : "border-ink/25 text-ink-3 hover:bg-ink/5"
              }`}
            >
              {c}
            </Link>
          ))}
        </nav>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s, i) => (
            <figure
              key={s.src + s.title}
              className={`paper-card overflow-hidden ${i === 0 ? "sm:col-span-2 lg:row-span-2" : ""}`}
            >
              <div className="relative overflow-hidden">
                <Image
                  src={s.src}
                  width={1200}
                  height={800}
                  sizes={i === 0 ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
                  alt={s.title}
                  loading="lazy"
                  className={`w-full object-cover ${i === 0 ? "h-[300px] lg:h-[420px]" : "h-[220px]"}`}
                />
                <span className="absolute top-3 left-3 rounded-sm bg-ink/85 px-2.5 py-1 text-[13px] text-paper">
                  {s.cat}
                </span>
              </div>
              <figcaption className="p-4">
                <h2 className="text-[19px]">{s.title}</h2>
                <p className="mt-1 text-[14.5px] text-ink-3">{s.note}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        {list.length === 0 && (
          <p className="py-16 text-center text-ink-3">এই ক্যাটাগরিতে কোনো ছবি নেই।</p>
        )}

        <div className="paper-card mt-10 flex flex-wrap items-center gap-4 p-6">
          <div className="flex-1">
            <h2 className="text-[24px]">নিজের পোশাকের ছবি দিতে চান?</h2>
            <p className="text-[15.5px] text-ink-3">
              অর্ডারের সঙ্গে ডিজাইন রেফারেন্স বা কাপড়ের ছবি যুক্ত করা যায় — কারিগরদের কাজ সহজ হয়।
            </p>
          </div>
          <Link href="/book" className="rounded-sm bg-ink px-5 py-3 text-[15.5px] text-paper hover:bg-ink-2">
            অ্যাপয়েন্টমেন্ট নিন
          </Link>
        </div>
      </section>
    </PublicPage>
  );
}
