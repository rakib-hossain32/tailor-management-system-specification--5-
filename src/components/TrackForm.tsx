"use client";

import { useState } from "react";
import { SearchCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TrackResult {
  order_no: string;
  status: string;
  status_label_bn: string;
  progress_step: number;
  steps: string[];
  delivery_date: string;
  trial_date: string | null;
  due_amount: number;
  urgent: boolean;
}

export function TrackForm({ compact = false }: { compact?: boolean }) {
  const [phone, setPhone] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runTrack(p: string, o: string) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/public/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: p, order_no: o }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error?.message ?? "ট্র্যাক করা যায়নি");
      else setResult(data as TrackResult);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await runTrack(phone, orderNo);
  }

  function fillDemo() {
    const demoPhone = "01712345678";
    const demoOrder = "TP-2611-0043";
    setPhone(demoPhone);
    setOrderNo(demoOrder);
    void runTrack(demoPhone, demoOrder);
  }

  return (
    <div className={compact ? "" : "luxury-card p-6 sm:p-8"}>
      <form onSubmit={submit} className="grid gap-3.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="tr-phone">মোবাইল নম্বর</Label>
          <Input
            id="tr-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="01XXXXXXXXX"
            className="num"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tr-order">অর্ডার নম্বর</Label>
          <Input
            id="tr-order"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value.toUpperCase())}
            placeholder="TP-2611-0043"
            className="num uppercase"
          />
        </div>
        <Button type="submit" variant="gold" disabled={busy}>
          <SearchCheck className="size-4" />
          {busy ? "খোঁজা হচ্ছে…" : "ট্র্যাক করুন"}
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-stone">
        <span>নমুনা দেখতে চান?</span>
        <button
          type="button"
          onClick={fillDemo}
          className="num font-medium text-gold-dark underline underline-offset-4 hover:text-ink"
        >
          ডেমো অর্ডার (TP-2611-0043) ট্র্যাক করে দেখুন
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-lg border border-gold/40 bg-paper/70 p-5 rise">
          <div className="flex flex-wrap items-center gap-3">
            <span className="num text-[21px] font-semibold text-ink">{result.order_no}</span>
            <Badge variant="gold" className="text-[14px]">
              {result.status_label_bn}
            </Badge>
            {result.urgent && <Badge variant="destructive">জরুরি</Badge>}
          </div>

          <ol className="mt-5 grid grid-cols-4 gap-2">
            {result.steps.map((s, i) => {
              const done = i <= result.progress_step;
              const current = i === result.progress_step;
              return (
                <li key={s}>
                  <div
                    className={`h-2.5 rounded-full transition-colors ${
                      done ? "bg-gold" : "bg-ink/12"
                    } ${current ? "ring-2 ring-gold/40" : ""}`}
                  />
                  <div
                    className={`mt-2 text-[13px] leading-snug ${
                      current ? "font-semibold text-ink" : done ? "text-ink-3" : "text-stone"
                    }`}
                  >
                    {s}
                  </div>
                </li>
              );
            })}
          </ol>

          <dl className="mt-5 grid gap-4 border-t border-dashed border-ink/15 pt-4 sm:grid-cols-3">
            <div>
              <dt className="smallcaps text-stone">ডেলিভারি তারিখ</dt>
              <dd className="num mt-0.5 text-[17px] font-medium">{result.delivery_date}</dd>
            </div>
            {result.trial_date && (
              <div>
                <dt className="smallcaps text-stone">ট্রায়াল তারিখ</dt>
                <dd className="num mt-0.5 text-[17px] font-medium">{result.trial_date}</dd>
              </div>
            )}
            <div>
              <dt className="smallcaps text-stone">বকেয়া পরিমাণ</dt>
              <dd
                className={`num mt-0.5 text-[17px] font-semibold ${
                  result.due_amount > 0 ? "text-chalk" : "text-[#1D6B3F]"
                }`}
              >
                ৳{Math.round(result.due_amount).toLocaleString("en-US")}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[12.5px] text-stone">
            নিরাপত্তা নীতি: এই পাতায় শুধু অর্ডারের অগ্রগতি দেখানো হয় — আপনার মাপ বা ব্যক্তিগত তথ্য নয়।
          </p>
        </div>
      )}
    </div>
  );
}
