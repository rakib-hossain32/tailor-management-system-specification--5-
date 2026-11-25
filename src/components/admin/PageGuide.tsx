import { Card, CardContent } from "@/components/ui/card";

/**
 * "এই পেজে কী করা যায়" — a three-point guide strip shown under a page
 * head, so the page's job is obvious at a glance without training.
 * Used by the orders list, new-order and new-customer pages.
 */
export function PageGuide({ items }: { items: [string, string][] }) {
  if (items.length === 0) return null;
  return (
    <Card className="border-gold/40 bg-gold-light/25">
      <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
        {items.map(([title, text], i) => (
          <div key={title} className="flex gap-3">
            <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-gold font-semibold text-ink">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="font-medium leading-snug">{title}</div>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-3">{text}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
