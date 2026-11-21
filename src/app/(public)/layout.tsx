import Link from "next/link";
import { PhoneCall, CalendarCheck } from "lucide-react";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";

/**
 * Public / marketing site shell — fully separate from the admin layout.
 * Renders header, footer and the mobile call/book action bar exactly once.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-paper">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />

      {/* mobile sticky action bar */}
      <div className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-gold/40 bg-ink text-paper shadow-2xl sm:hidden">
        <a
          href="tel:+8801711000001"
          className="flex items-center justify-center gap-2 border-r border-white/15 py-3 text-[14.5px] font-medium text-white active:bg-white/10"
        >
          <PhoneCall className="size-4 text-gold" />
          কল করুন
        </a>
        <Link
          href="/book"
          className="flex items-center justify-center gap-2 bg-gold py-3 text-[14.5px] font-semibold text-ink active:bg-gold-light"
        >
          <CalendarCheck className="size-4" />
          অ্যাপয়েন্টমেন্ট
        </Link>
      </div>
      <div className="h-12 sm:hidden" aria-hidden />
    </div>
  );
}
