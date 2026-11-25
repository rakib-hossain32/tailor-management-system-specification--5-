"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Kanban,
  PlusCircle,
  AlertTriangle,
  Scissors,
  Users,
  UserPlus,
  Ruler,
  CalendarClock,
  Wallet,
  Receipt,
  Package,
  BarChart3,
  HardHat,
  Banknote,
  MessageSquare,
  Settings,
  Menu,
} from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { logoutStaff } from "@/app/(public)/staff-login/actions";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    title: "অর্ডার ও কাজ",
    items: [
      { href: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
      { href: "/admin/orders", label: "অর্ডার তালিকা", icon: ClipboardList },
      { href: "/admin/orders/board", label: "কানবান বোর্ড", icon: Kanban },
      { href: "/admin/orders/new", label: "নতুন অর্ডার", icon: PlusCircle },
      { href: "/admin/orders/overdue", label: "ওভারডিউ তালিকা", icon: AlertTriangle },
      { href: "/admin/tasks", label: "কারিগর কাজ বণ্টন", icon: Scissors },
    ],
  },
  {
    title: "কাস্টমার ও মাপ",
    items: [
      { href: "/admin/customers", label: "কাস্টমার খাতা", icon: Users },
      { href: "/admin/customers/new", label: "নতুন কাস্টমার", icon: UserPlus },
      { href: "/admin/measurements", label: "মাপের কার্ড", icon: Ruler },
      { href: "/admin/appointments", label: "অ্যাপয়েন্টমেন্ট", icon: CalendarClock },
    ],
  },
  {
    title: "হিসাব ও স্টক",
    items: [
      { href: "/admin/payments", label: "পেমেন্ট ও বকেয়া", icon: Wallet },
      { href: "/admin/expenses", label: "দৈনন্দিন খরচ", icon: Receipt },
      { href: "/admin/inventory", label: "কাপড় ও স্টক", icon: Package },
      { href: "/admin/reports", label: "আর্থিক রিপোর্ট", icon: BarChart3 },
    ],
  },
  {
    title: "ব্যবস্থাপনা",
    items: [
      { href: "/admin/workers", label: "কারিগর তালিকা", icon: HardHat },
      { href: "/admin/workers/payroll", label: "মজুরি ও পেরোল", icon: Banknote },
      { href: "/admin/notifications", label: "SMS ও নোটিফিকেশন", icon: MessageSquare },
      { href: "/admin/settings", label: "দোকান সেটিংস", icon: Settings },
      { href: "/admin/manage", label: "তথ্য যোগ ও সম্পাদনা", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/orders") return pathname === "/admin/orders";
  if (href === "/admin/customers") return pathname === "/admin/customers";
  if (href === "/admin/workers") return pathname === "/admin/workers";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TapeRail() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop Executive Sidebar — fits 100vh cleanly with no scrollbars */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between border-r border-gold/25 bg-ink text-paper select-none lg:flex">
        {/* Top Brand Header */}
        <div>
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
            <div className="flex size-9 items-center justify-center rounded-md bg-gold/15 text-gold ring-1 ring-gold/40">
              <Logo size={24} />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-display text-[16.5px] text-white">রহমান টেইলার্স</div>
              <div className="smallcaps text-[9.5px] text-gold">TailorPro · অ্যাডমিন</div>
            </div>
          </div>

          {/* Compact Navigation Groups — zero vertical or horizontal scrollbar */}
          <nav className="px-3 py-2" aria-label="অ্যাডমিন নেভিগেশন">
            {GROUPS.map((group) => (
              <div key={group.title} className="mb-2 last:mb-0">
                <div className="smallcaps px-2.5 pt-1.5 pb-1 text-[9.5px] tracking-widest text-white/45">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] leading-snug transition-all ${
                          active
                            ? "bg-gold font-medium text-ink shadow-xs"
                            : "text-white/80 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`size-4 shrink-0 ${
                            active ? "text-ink" : "text-gold/80 group-hover:text-gold"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer — staff entry points only (worker view is not linked from admin) */}
        <div className="border-t border-white/10 bg-black/20 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2 text-[12.5px]">
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-1.5 text-white/75 transition-colors hover:text-gold"
            >
              <Settings className="size-3.5 text-gold" />
              সেটিংস
            </Link>
            <form action={logoutStaff}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-white/75 transition-colors hover:text-gold"
              >
                লগআউট ↩
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile / Tablet Top Header — no horizontal scrollbar */}
      <div className="no-print sticky top-0 z-40 border-b border-ink/15 bg-ink text-paper lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-gold/15 text-gold ring-1 ring-gold/40">
              <Logo size={20} />
            </div>
            <div className="leading-tight">
              <span className="block font-display text-[15.5px] text-white">রহমান টেইলার্স</span>
              <span className="smallcaps block text-[9px] text-gold">অ্যাডমিন প্যানেল</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="gold" size="sm">
              <Link href="/admin/orders/new">+ অর্ডার</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMobileOpen(true)}
              className="border-white/25 bg-white/10 text-white hover:bg-white/20"
              aria-label="নেভিগেশন মেনু খুলুন"
            >
              <Menu className="size-4" />
              মেনু
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Slide-Over Navigation Drawer */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="max-h-[90vh] w-[92vw] max-w-sm overflow-y-auto thin-scroll border-gold/30 bg-ink p-0 text-white">
          <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4 pr-14">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gold/15 text-gold">
              <Logo size={20} />
            </span>
            <DialogTitle className="truncate font-display text-lg text-white">
              রহমান টেইলার্স · মেনু
            </DialogTitle>
            {/* close (single cross) is rendered by DialogContent */}
          </div>

          <div className="space-y-4 p-4">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <div className="smallcaps px-2.5 pb-1.5 text-[10px] text-gold/80">
                  {group.title}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-[14.5px] ${
                          active
                            ? "bg-gold font-medium text-ink"
                            : "text-white/85 hover:bg-white/10"
                        }`}
                      >
                        <Icon className={`size-4 ${active ? "text-ink" : "text-gold"}`} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[13.5px]">
              <Link
                href="/worker"
                onClick={() => setMobileOpen(false)}
                className="text-gold hover:underline"
              >
                কারিগর ভিউ →
              </Link>
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="text-white/80 hover:underline"
              >
                পাবলিক ওয়েবসাইট ↗
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
