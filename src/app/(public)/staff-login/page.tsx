import Link from "next/link";
import { ShieldCheck, KeyRound, HardHat } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffLoginForm } from "@/components/StaffLoginForm";
import { Logo } from "@/components/Logo";

export const metadata = { title: "স্টাফ লগইন" };
export const dynamic = "force-dynamic";

const DEMO = [
  {
    role: "অ্যাডমিন / মালিক",
    email: "admin@rahimantailors.com",
    password: "admin123",
    goes: "/admin — পুরো ড্যাশবোর্ড, অর্ডার, হিসাব ও রিপোর্ট",
    icon: ShieldCheck,
  },
  {
    role: "কারিগর",
    email: "worker@rahimantailors.com",
    password: "worker123",
    goes: "/worker — শুধু নিজের কাজ ও মজুরি",
    icon: HardHat,
  },
];

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const demoMode = process.env.LOCAL_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
  return (
    <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:py-16">
      <div className="dark-luxury-card flex flex-col justify-between p-7">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/40">
              <Logo size={28} />
            </span>
            <div>
              <div className="font-display text-[22px] text-white">রহমান টেইলার্স</div>
              <div className="smallcaps text-[9.5px] text-gold">Staff Control Panel</div>
            </div>
          </div>

          <h1 className="mt-6 text-[30px] leading-tight text-white sm:text-[36px]">স্টাফ লগইন</h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-paper/80">
            একটিমাত্র লগইন — <b className="text-white">ইমেইল বা মোবাইল নম্বর</b> যেকোনো একটি দিন।
            দোকান থেকে দেওয়া অ্যাকাউন্ট যাচাই করে ভূমিকা অনুযায়ী অ্যাডমিন বা
            কারিগর পাতায় নিয়ে যাওয়া হবে।
          </p>

          <ul className="mt-5 space-y-2.5 text-[14.5px] text-paper/85">
            <li className="flex gap-2.5">
              <span className="text-gold">•</span> পাসওয়ার্ড সার্ভারে scrypt হ্যাশে সংরক্ষিত
            </li>
            <li className="flex gap-2.5">
              <span className="text-gold">•</span> নতুন স্টাফের অ্যাকাউন্ট মালিক বা ম্যানেজার চালু করেন
            </li>
            <li className="flex gap-2.5">
              <span className="text-gold">•</span> কারিগর কখনো অ্যাডমিন প্যানেল দেখতে পারেন না
            </li>
          </ul>
        </div>

        {demoMode && <div className="mt-7 rounded-lg border border-white/15 bg-white/5 p-4">
          <div className="smallcaps mb-2 text-gold">ডেমো অ্যাকাউন্ট</div>
          <ul className="space-y-2.5">
            {DEMO.map((d) => {
              const Icon = d.icon;
              return (
                <li key={d.email} className="flex items-start gap-2.5 text-[13.5px] text-paper/85">
                  <Icon className="mt-0.5 size-4 shrink-0 text-gold" />
                  <span className="min-w-0">
                    <span className="block font-medium text-white">{d.role}</span>
                    <span className="num block break-all">{d.email}</span>
                    <span className="num block break-all text-gold">{d.password}</span>
                    <span className="block text-[12.5px] text-paper/60">{d.goes}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[24px]">
            <KeyRound className="size-5 text-gold-dark" />
            প্রবেশ করুন
          </CardTitle>
          <CardDescription>ইমেইল বা মোবাইল নম্বর — যেকোনো একটি ও পাসওয়ার্ড।</CardDescription>
        </CardHeader>
        <CardContent>
          <StaffLoginForm initialError={error} demoAccounts={demoMode ? DEMO.map((d) => ({ identifier: d.email, password: d.password, label: d.role })) : []} />

          <div className="mt-5 flex flex-wrap gap-4 text-[14.5px]">
            <Link href="/" className="chalk-link text-gold-dark">
              ← পাবলিক ওয়েবসাইট
            </Link>
            <Link href="/login" className="chalk-link text-gold-dark">
              কাস্টমার লগইন (OTP)
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
