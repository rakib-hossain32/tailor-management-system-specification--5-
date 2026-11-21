import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { CalendarCheck, CheckCircle2, Sparkles, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { garmentTypes } from "@/db/schema";
import { PublicPage, SectionHead } from "@/components/public/PublicPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { flattenFields, type MeasurementSchema, type StyleSchema } from "@/lib/measurements";

export const dynamic = "force-dynamic";
export const metadata = { title: "সার্ভিস ও মূল্য তালিকা" };

const CATEGORY_BN: Record<string, string> = {
  gents: "জেন্টস বেসপোক",
  ladies: "লেডিস আটেলিয়ার",
  kids: "জুনিয়র বেসপোক",
  unisex: "ইউনিসেক্স",
};

export default async function ServicesPage() {
  const garments = await db
    .select()
    .from(garmentTypes)
    .where(eq(garmentTypes.isActive, true))
    .orderBy(asc(garmentTypes.sortOrder));

  return (
    <PublicPage>
      <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6">
        <SectionHead
          eyebrow="বেসপোক সার্ভিস ও মজুরি"
          title="আমাদের কারুশিল্প, সেলাই মজুরি ও সময়কাল"
          sub="প্রতিটি পোশাকের মূল্য নির্ভর করে কাপড়ের ধরন, লাইনিং ও কাজের জটিলতার ওপর। অর্ডার নিশ্চিত করার আগেই চূড়ান্ত মূল্য লিখিত মেমোতে জানিয়ে দেওয়া হয় — কোনো লুকানো চার্জ নেই।"
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
          <div className="luxury-card overflow-hidden p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl">স্ট্যান্ডার্ড সেলাই মজুরি তালিকা</h2>
              <Badge variant="gold">১০০% ফিটিং গ্যারান্টি</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>পোশাকের নাম</TableHead>
                  <TableHead>বিভাগ</TableHead>
                  <TableHead>শুরুর মজুরি</TableHead>
                  <TableHead>ডেলিভারি সময়</TableHead>
                  <TableHead className="text-right">আনুমানিক কাপড়</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {garments.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <span className="text-[15.5px] font-medium text-ink">{g.nameBn}</span>
                      <span className="block text-[12.5px] text-stone">{g.nameEn}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORY_BN[g.category] ?? g.category}</Badge>
                    </TableCell>
                    <TableCell className="num text-[15.5px] font-semibold text-ink">
                      ৳ {Number(g.basePrice).toLocaleString("en-US")}+
                    </TableCell>
                    <TableCell className="text-ink-3">{g.defaultDeliveryDays} কর্মদিবস</TableCell>
                    <TableCell className="num text-right text-ink-3">
                      {g.defaultFabricEstimate ? `${Number(g.defaultFabricEstimate)} গজ` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <aside className="space-y-6">
            <div className="dark-luxury-card p-6">
              <div className="flex items-center gap-2 text-gold">
                <Sparkles className="size-4" />
                <span className="smallcaps">বিশেষ সেবাসমূহ</span>
              </div>
              <h2 className="mt-2 text-2xl text-white">কাস্টম ও ভিআইপি টেইলরিং</h2>
              <ul className="mt-4 space-y-3 text-[14.5px] text-paper/85">
                {[
                  "কাস্টম বেসপোক পোশাক (শারীরিক গঠন অনুযায়ী নিখুঁত কাটিং)",
                  "ডেলিভারির ৭ দিনের মধ্যে সম্পূর্ণ ফ্রি ফিট অল্টারেশন",
                  "বিয়ে ও পারিবারিক গ্রুপ অর্ডার (একই থিমে সবার পোশাক)",
                  "কর্পোরেট ও প্রাতিষ্ঠানিক এক্সিকিউটিভ ইউনিফর্ম",
                  "প্রিয় পুরনো পোশাকের মাপ থেকে হুবহু কপি তৈরি",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button asChild variant="gold" className="w-full">
                  <Link href="/book">
                    <CalendarCheck className="size-4" />
                    মাপ দিতে অ্যাপয়েন্টমেন্ট নিন
                  </Link>
                </Button>
              </div>
            </div>

            <div className="paper-card p-6">
              <div className="flex items-center gap-2 text-gold-dark">
                <ShieldCheck className="size-4" />
                <span className="smallcaps">পেমেন্ট ও বুকিং নীতি</span>
              </div>
              <h3 className="mt-2 text-xl">স্বচ্ছ ও নিরাপদ লেনদেন</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">
                অর্ডার কনফার্ম করার সময় ন্যূনতম ৫০% অ্যাডভান্স গ্রহণ করা হয় এবং সাথে সাথে প্রিন্টেড মেমো ও কনফার্মেশন SMS প্রদান করা হয়।
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["ক্যাশ", "bKash", "Nagad", "Rocket", "কার্ড/ব্যাংক"].map((m) => (
                  <Badge key={m} variant="secondary">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Per-garment measurement & style breakdown */}
      <section className="border-t border-ink/10 bg-paper-2/65 py-14">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="max-w-2xl">
            <div className="smallcaps text-gold-dark">টেকনিক্যাল নির্ভুলতা</div>
            <h2 className="mt-2 text-[30px] sm:text-[38px]">
              প্রতিটি পোশাকে কোন কোন মাপ ও স্টাইল নেওয়া হয়
            </h2>
            <p className="mt-2 text-[15.5px] text-ink-3">
              আমাদের ডিজিটাল মাপ সিস্টেমে প্রতিটি পোশাকের জন্য আলাদা মাপ-স্কিমা ও কাস্টম স্টাইল অপশন সংরক্ষিত থাকে।
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {garments.map((g) => {
              const schema = g.measurementSchema as unknown as MeasurementSchema;
              const styleSchema = (g.styleSchema ?? { options: [] }) as unknown as StyleSchema;
              const fields = flattenFields(schema);
              return (
                <article key={g.id} className="paper-card flex flex-col justify-between p-6">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-[22px] text-ink">{g.nameBn}</h3>
                      <span className="num text-[17px] font-semibold text-gold-dark">
                        ৳{Number(g.basePrice).toLocaleString("en-US")}+
                      </span>
                    </div>
                    <div className="smallcaps mt-1 text-stone">
                      {fields.length}টি শারীরিক মাপ · {styleSchema.options.length}টি স্টাইল অপশন
                    </div>

                    <div className="mt-4">
                      <div className="smallcaps mb-2 text-[10px] text-stone">মাপের অংশসমূহ</div>
                      <ul className="flex flex-wrap gap-1.5">
                        {fields.map((f) => (
                          <li key={f.key}>
                            <Badge variant="outline">{f.label_bn}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-dashed border-ink/15 pt-3.5">
                    <div className="smallcaps mb-2 text-[10px] text-stone">কাস্টম স্টাইল পছন্দ</div>
                    <ul className="flex flex-wrap gap-1.5">
                      {styleSchema.options.map((o) => (
                        <li key={o.key}>
                          <Badge variant="gold">{o.label_bn}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
