"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { toast.error("কাজটি সম্পন্ন হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", { id: error.digest || "page-error" }); }, [error]);
  return <main className="mx-auto max-w-xl px-5 py-20"><h1 className="text-3xl">কাজটি সম্পন্ন হয়নি</h1><p className="mt-3 text-ink-3">আবার চেষ্টা করুন। সমস্যা থাকলে দোকানের সঙ্গে যোগাযোগ করুন।</p><Button className="mt-6" onClick={reset}>আবার চেষ্টা করুন</Button></main>;
}
