"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginStaff } from "@/app/(public)/staff-login/actions";
import { useMutationFeedback } from "@/components/feedback/FeedbackProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StaffLoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useMutationFeedback(initialError ? { ok: false, text: initialError, title: "লগইন প্রয়োজন" } : null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/auth/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      const result = await response.json();
      if (!response.ok) { setMessage({ ok: false, title: "লগইন ব্যর্থ", text: result?.error?.message || "আবার চেষ্টা করুন।" }); return; }
      setMessage({ ok: true, title: "লগইন হয়েছে", text: result.name || "সঠিক পাতায় নিয়ে যাওয়া হচ্ছে।" });
      router.push(result.redirect);
      router.refresh();
    } catch { setMessage({ ok: false, text: "সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।" }); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4"><form action={loginStaff} onSubmit={submit} className="space-y-4"><div className="space-y-1.5"><Label htmlFor="sl-id">ইমেইল বা মোবাইল নম্বর</Label><Input id="sl-id" name="identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" placeholder="ইমেইল অথবা মোবাইল নম্বর" /></div><div className="space-y-1.5"><Label htmlFor="sl-pass">পাসওয়ার্ড</Label><Input id="sl-pass" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></div><Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "যাচাই হচ্ছে…" : "লগইন করুন"}</Button></form>{message && <Alert variant={message.ok ? "success" : "destructive"}>{message.title && <AlertTitle>{message.title}</AlertTitle>}<AlertDescription>{message.text}</AlertDescription></Alert>}</div>;
}