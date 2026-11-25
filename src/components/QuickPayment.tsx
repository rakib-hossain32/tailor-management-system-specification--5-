"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutationFeedback } from "@/components/feedback/FeedbackProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const METHODS = [
  { value: "cash", label: "ক্যাশ" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "bank", label: "ব্যাংক/কার্ড" },
];

export function QuickPayment({
  orderId,
  due,
}: {
  orderId: string;
  due: number;
  receivedBy?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(due > 0 ? String(Math.round(due)) : "");
  const [method, setMethod] = useState("cash");
  const [txn, setTxn] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useMutationFeedback();
  const pendingPayment = useRef<{ fingerprint: string; key: string; kind: string } | null>(null);
  const submitting = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMsg(null);
    try {
      const fingerprint = JSON.stringify({ orderId, amount, method, txn });
      if (pendingPayment.current?.fingerprint !== fingerprint) {
        pendingPayment.current = {
          fingerprint, key: crypto.randomUUID(),
          kind: Number(amount) >= due && due > 0 ? "final" : "installment",
        };
      }
      const res = await fetch(`/api/v1/orders/${orderId}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount,
          method,
          txnId: txn || undefined,
          kind: pendingPayment.current.kind,
          idempotencyKey: pendingPayment.current.key,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data?.error?.message ?? "পেমেন্ট সেভ হয়নি" });
      } else {
        pendingPayment.current = null;
        setMsg({
          ok: true,
          text: `রসিদ ${data.receipt_no} — বকেয়া ৳${Number(data.due_amount).toLocaleString("en-US")}`,
        });
        setTxn("");
        setAmount("");
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন" });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (due <= 0) {
    return <p className="text-[14.5px] text-stone">✓ এই অর্ডারের কোনো বকেয়া নেই।</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label htmlFor="pay-amount">টাকার পরিমাণ</Label>
          <Input
            id="pay-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="num"
          />
        </div>
        <div className="space-y-1.5">
          <Label>মাধ্যম</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger aria-label="পেমেন্ট মাধ্যম">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(method === "bkash" || method === "nagad" || method === "rocket") && (
        <Input
          value={txn}
          onChange={(e) => setTxn(e.target.value)}
          placeholder="ট্রানজেকশন আইডি / প্রেরক নম্বর"
          className="num"
        />
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "সেভ হচ্ছে…" : `পেমেন্ট গ্রহণ — ৳${Number(amount || 0).toLocaleString("en-US")}`}
      </Button>

      {msg && (
        <Alert variant={msg.ok ? "success" : "destructive"}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
