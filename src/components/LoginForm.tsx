"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMutationFeedback } from "@/components/feedback/FeedbackProvider";

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useMutationFeedback();

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "request", phone }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, title: "কোড পাঠানো যায়নি", text: data?.error?.message ?? "আবার চেষ্টা করুন" });
      else {
        setSent(true);
        setCode("");
        setMsg({ ok: true, text: "লগইন কোডের অনুরোধ গৃহীত হয়েছে।" });
      }
    } catch {
      setMsg({ ok: false, title: "নেটওয়ার্ক সমস্যা", text: "আবার চেষ্টা করুন" });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify", phone, code }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ ok: false, title: "যাচাই হয়নি", text: data?.error?.message ?? "কোড মিলছে না" });
      else {
        setMsg({ ok: true, text: `স্বাগতম, ${data.name} — পোর্টালে যাচ্ছেন…` });
        router.push("/account");
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, title: "নেটওয়ার্ক সমস্যা", text: "আবার চেষ্টা করুন" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={requestOtp} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="lg-phone">ফোন নম্বর</Label>
          <Input
            id="lg-phone"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setSent(false); setCode(""); }}
            inputMode="tel"
            placeholder="01XXXXXXXXX"
            className="num text-[19px]"
            autoComplete="tel"
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy || phone.trim().length < 11}>
          {busy ? "পাঠানো হচ্ছে…" : "OTP কোড চান"}
        </Button>
      </form>

      {sent && (
        <form onSubmit={verify} className="rise space-y-3">
          <Separator />
          <div className="space-y-1.5">
            <Label htmlFor="lg-code">৬ সংখ্যার কোড</Label>
            <Input
              id="lg-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="------"
              className="num text-[26px] tracking-[0.4em]"
            />
          </div>
          <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? "যাচাই হচ্ছে…" : "লগইন করুন"}
          </Button>
        </form>
      )}

      {msg && (
        <Alert variant={msg.ok ? "success" : "destructive"}>
          {msg.title && <AlertTitle>{msg.title}</AlertTitle>}
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
