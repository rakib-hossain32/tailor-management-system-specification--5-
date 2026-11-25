"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutationError } from "@/components/feedback/FeedbackProvider";
import { nextStatuses, statusMeta } from "@/lib/order-status";
import { Button } from "@/components/ui/button";

/** Compact status mover used on the kanban board. */
export function QuickStatus({
  orderId,
  current,
  due,
}: {
  orderId: string;
  current: string;
  due: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useMutationError();
  const [open, setOpen] = useState(false);

  const options = nextStatuses(current);
  if (options.length === 0) return null;

  async function move(to: string) {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { to };
      if (to === "delivered" && due > 0) {
        const reason = window.prompt(`বকেয়া ৳${due} সহ ডেলিভারির কারণ লিখুন:`, "মালিক সম্মত");
        if (!reason) {
          setBusy(false);
          return;
        }
        payload.override_due = true;
        payload.override_reason = reason;
      }
      if (to === "cancelled" && !window.confirm("অর্ডারটি বাতিল করবেন?")) {
        setBusy(false);
        return;
      }
      const res = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error?.message ?? "বদলানো যায়নি");
      else {
        setOpen(false);
        toast.success(`অর্ডার: ${statusMeta(to).labelBn}`);
        router.refresh();
      }
    } catch {
      setError("নেটওয়ার্ক সমস্যা");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full">
        ধাপ বদলান →
      </Button>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((to) => (
          <Button
            key={to}
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => move(to)}
            variant={to === "cancelled" ? "outline" : "default"}
            className={to === "cancelled" ? "border-chalk/40 text-chalk hover:bg-chalk-light" : ""}
          >
            {statusMeta(to).icon} {statusMeta(to).labelBn}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          বাতিল
        </Button>
      </div>
      {error && <p className="text-[13px] text-chalk">{error}</p>}
    </div>
  );
}
