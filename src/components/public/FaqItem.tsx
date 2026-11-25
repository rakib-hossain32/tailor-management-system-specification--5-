"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One FAQ entry — a shadcn Button header (aria-expanded) over a
 * collapsible region. Replaces the raw <details>/<summary> pair so the
 * public site uses the same component system as everything else.
 */
export function FaqItem({ heading, body }: { heading: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="paper-card p-5">
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-0 text-left text-lg font-medium hover:bg-transparent"
      >
        <span>{heading}</span>
        <ChevronDown className={cn("size-5 shrink-0 text-gold-dark transition-transform", open && "rotate-180")} />
      </Button>
      {open && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-3">{body}</p>}
    </div>
  );
}
