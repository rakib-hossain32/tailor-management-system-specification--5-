import { Badge } from "@/components/ui/badge";
import { statusMeta } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const m = statusMeta(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium",
        size === "md" ? "px-3 py-1 text-[15px]" : "px-2.5 py-0.5 text-[13px]",
        className,
      )}
      style={{ color: m.fg, backgroundColor: m.bg }}
    >
      <span aria-hidden className="text-[0.95em] leading-none">
        {m.icon}
      </span>
      {m.labelBn}
    </Badge>
  );
}

export function DueBadge({ due, size = "sm" }: { due: number | string; size?: "sm" | "md" }) {
  const n = Number(due);
  if (!Number.isFinite(n) || n <= 0) return null;
  return (
    <Badge variant="destructive" className={cn("num", size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[12px]")}>
      ৳{Math.round(n).toLocaleString("en-US")}
    </Badge>
  );
}

export function UrgentBadge({ className }: { className?: string }) {
  return (
    <Badge variant="destructive" className={cn("tracking-wide", className)}>
      জরুরি
    </Badge>
  );
}
