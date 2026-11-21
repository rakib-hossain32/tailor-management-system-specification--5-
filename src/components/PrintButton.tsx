"use client";

export function PrintButton({ label = "প্রিন্ট করুন" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-sm bg-ink px-5 py-2.5 text-[15px] text-paper transition-colors hover:bg-ink-2"
    >
      ⎙ {label}
    </button>
  );
}
