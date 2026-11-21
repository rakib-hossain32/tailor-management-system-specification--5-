"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck, UserCog } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginStaff } from "@/app/(public)/staff-login/actions";

/**
 * Staff sign-in — email **or** phone, whichever the user gives.
 * Talks to /api/v1/auth/staff (a route handler) so it never depends on the
 * Server-Action origin check → no "This page could not load".
 */
export function StaffLoginForm({ demoAccounts = [], initialError }: { demoAccounts?: { identifier: string; password: string; label: string }[]; initialError?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; title?: string } | null>(initialError ? { ok: false, text: initialError, title: "লগইন প্রয়োজন" } : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/auth/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({
          ok: false,
          title: "লগইন ব্যর্থ",
          text: data?.error?.message ?? "আবার চেষ্টা করুন",
        });
        return;
      }
      setMsg({
        ok: true,
        title: "স্বাগতম ✓",
        text: `${data.name} — সঠিক পাতায় নিয়ে যাওয়া হচ্ছে…`,
      });
      router.push(data.redirect as string);
      router.refresh();
    } catch {
      setMsg({
        ok: false,
        title: "নেটওয়ার্ক সমস্যা",
        text: "আবার চেষ্টা করুন — সংযোগ যাচাই করুন।",
      });
    } finally {
      setBusy(false);
    }
  }

  function fill(v: string, p: string) {
    setIdentifier(v);
    setPassword(p);
    setMsg(null);
  }

  return (
    <div className="space-y-4">
      <form action={loginStaff} onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sl-id">ইমেইল বা মোবাইল নম্বর</Label>
          <Input
            id="sl-id"
            name="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
            placeholder="admin@rahimantailors.com  অথবা  01XXXXXXXXX"
            className="num"
          />
          <p className="text-[13px] text-stone">
            দোকান থেকে দেওয়া অ্যাকাউন্ট ব্যবহার করুন। নতুন অ্যাকাউন্টের জন্য ম্যানেজারকে জানান।
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sl-pass">পাসওয়ার্ড</Label>
          <Input
            id="sl-pass"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              যাচাই হচ্ছে…
            </>
          ) : (
            <>
              লগইন করুন
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      {msg && (
        <Alert variant={msg.ok ? "success" : "destructive"}>
          {msg.title && <AlertTitle>{msg.title}</AlertTitle>}
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      {demoAccounts.length > 0 && (
        <div className="rounded-md border border-gold/50 bg-gold-light/40 p-3.5">
          <div className="smallcaps mb-2 flex items-center gap-1.5 text-gold-dark">
            <ShieldCheck className="size-3.5" /> ডেমো দ্রুত প্রবেশ
          </div>
          <div className="flex flex-wrap gap-2">
            {demoAccounts.map((account) => (
              <Button key={account.identifier} type="button" variant="outline" size="sm" onClick={() => fill(account.identifier, account.password)}>
                <UserCog className="size-3.5" /> {account.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
