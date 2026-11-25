"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutationError } from "@/components/feedback/FeedbackProvider";
import { nextStatuses, statusMeta } from "@/lib/order-status";

/** Compact status mover used on the kanban board. */
export function QuickStatus({
  orderId,
  current,
  due,
  compact = false,
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full rounded-sm border border-ink/25 px-2.5 py-1.5 text-[13.5px] transition-colors hover:bg-ink/5 ${
          compact ? "" : ""
        }`}
      >
        ধাপ বদলান →
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((to) => (
          <button
            key={to}
            type="button"
            disabled={busy}
            onClick={() => move(to)}
            className={`rounded-sm px-2.5 py-1.5 text-[13px] font-medium disabled:opacity-60 ${
              to === "cancelled"
                ? "border border-chalk/40 text-chalk hover:bg-chalk-light"
                : "bg-ink text-paper hover:bg-ink-2"
            }`}
          >
            {statusMeta(to).icon} {statusMeta(to).labelBn}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-sm border border-ink/20 px-2 py-1.5 text-[13px] text-stone"
        >
          বাতিল
        </button>
      </div>
      {error && <p className="text-[13px] text-chalk">{error}</p>}
    </div>
  );
}
