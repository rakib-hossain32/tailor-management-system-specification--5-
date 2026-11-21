import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Server-rendered pagination. Each page shows at most `pageSize` rows so a
 * single request never has to render dozens of cards/rows at once.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
  total,
  label = "রেকর্ড",
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  total: number;
  label?: string;
}) {
  const safeTotal = Math.max(1, totalPages);
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const pages: number[] = [];
  const from = Math.max(1, Math.min(page - 2, safeTotal - 4));
  const to = Math.min(safeTotal, from + 4);
  for (let i = from; i <= to; i++) pages.push(i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-4 py-3">
      <span className="text-[13.5px] text-stone">
        মোট {total} {label} · পৃষ্ঠা {page}/{safeTotal}
      </span>

      <nav className="flex items-center gap-1.5" aria-label="পেজিনেশন">
        <Link
          href={href(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-md border border-ink/20 bg-white px-3 text-[14px] transition-colors",
            page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-paper-2",
          )}
        >
          <ChevronLeft className="size-4" />
          আগের
        </Link>

        {pages.map((p) => (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "num inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2.5 text-[14px] transition-colors",
              p === page
                ? "border-ink bg-ink text-paper"
                : "border-ink/20 bg-white hover:bg-paper-2",
            )}
          >
            {p}
          </Link>
        ))}

        <Link
          href={href(Math.min(safeTotal, page + 1))}
          aria-disabled={page >= safeTotal}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-md border border-ink/20 bg-white px-3 text-[14px] transition-colors",
            page >= safeTotal ? "pointer-events-none opacity-40" : "hover:bg-paper-2",
          )}
        >
          পরের
          <ChevronRight className="size-4" />
        </Link>
      </nav>
    </div>
  );
}
