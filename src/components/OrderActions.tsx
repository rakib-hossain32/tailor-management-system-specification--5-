"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutationError } from "@/components/feedback/FeedbackProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nextStatuses, statusMeta } from "@/lib/order-status";
import { taka } from "@/lib/format";

const CONFIRM = ["cancelled"];

export function OrderActions({
  orderId,
  current,
  due,
}: {
  orderId: string;
  current: string;
  due: number;
  changedBy?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useMutationError();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const options = nextStatuses(current);

  async function move(to: string, overrideReason?: string) {
    setBusy(to);
    setError(null);
    try {
      const payload: Record<string, unknown> = { to, note: note || undefined };
      if (to === "delivered" && due > 0) {
        payload.override_due = true;
        payload.override_reason = overrideReason;
      }
      const res = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "স্ট্যাটাস বদলানো যায়নি");
        setPending(null);
      } else {
        setNote("");
        setReason("");
        setPending(null);
        toast.success(`অর্ডার: ${statusMeta(to).labelBn}`);
        router.refresh();
      }
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setBusy(null);
    }
  }

  function request(to: string) {
    setError(null);
    if (CONFIRM.includes(to)) {
      setReason("");
      setPending(to);
      return;
    }
    if (to === "delivered" && due > 0) {
      setReason("কাস্টমার পরে দেবেন — মালিক সম্মত");
      setPending(to);
      return;
    }
    void move(to);
  }

  const needsReason = pending === "cancelled" || (pending === "delivered" && due > 0);

  return (
    <div className="space-y-3">
      <div className="smallcaps text-stone">পরবর্তী ধাপ</div>
      {options.length === 0 ? (
        <p className="text-[14.5px] text-ink-3">
          {current === "delivered" ? "অর্ডারটি সম্পন্ন হয়েছে।" : "কোনো ধাপ বাকি নেই।"}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((to) => {
            const meta = statusMeta(to);
            const danger = to === "cancelled";
            return (
              <Button
                key={to}
                type="button"
                variant={danger ? "destructive" : to === "delivered" ? "gold" : "outline"}
                disabled={busy !== null}
                onClick={() => request(to)}
              >
                {busy === to ? "হচ্ছে…" : `${meta.icon} ${meta.labelBn}`}
              </Button>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="status-note">নোট (ঐচ্ছিক)</Label>
        <Textarea
          id="status-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="যেমন: কাস্টমারকে ফোন করা হয়েছে"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>বদলানো যায়নি</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending === "cancelled" ? "অর্ডার বাতিল করবেন?" : "বকেয়া সহ ডেলিভারি?"}
            </DialogTitle>
            <DialogDescription>
              {pending === "cancelled"
                ? "বাতিল করলে কারণ ইতিহাসে লিপিবদ্ধ থাকবে এবং এটি ফিরিয়ে আনা যাবে না।"
                : `অর্ডারে ${taka(due)} বকেয়া আছে। ডেলিভারির জন্য কারণ লিখুন — মালিক/ম্যানেজার ছাড়া এটি সম্ভব নয়।`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="oa-reason">{pending === "cancelled" ? "বাতিলের কারণ *" : "ওভাররাইডের কারণ *"}</Label>
            <Textarea
              id="oa-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={pending === "cancelled" ? "যেমন: কাস্টমার অন্য দোকান থেকে নিয়েছেন" : "যেমন: মালিক সম্মত, পরে দেবেন"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              থামুন
            </Button>
            <Button
              type="button"
              variant={pending === "cancelled" ? "destructive" : "default"}
              disabled={busy !== null || reason.trim().length < 4}
              onClick={() => pending && void move(pending, reason.trim() || undefined)}
            >
              {busy ? "হচ্ছে…" : "নিশ্চিত করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
