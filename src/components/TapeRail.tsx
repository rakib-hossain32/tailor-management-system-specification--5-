"use client";

import { useEffect, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Database,
  Globe,
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

/**
 * Sidebar information architecture — every route lives under exactly
 * one heading, ordered by the shop's daily workflow:
 * sell → serve the customer → get the work made → count the money →
 * run the shop. The dashboard stands alone above the groups.
 */
const TOP_ITEMS: NavItem[] = [
  { href: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
];

const GROUPS: NavGroup[] = [
  {
    title: "বিক্রি ও অর্ডার",
    items: [
      { href: "/admin/orders", label: "অর্ডার তালিকা", icon: ClipboardList },
      { href: "/admin/orders/new", label: "নতুন অর্ডার", icon: PlusCircle },
      { href: "/admin/orders/board", label: "কানবান বোর্ড", icon: Kanban },
      { href: "/admin/orders/overdue", label: "ওভারডিউ তালিকা", icon: AlertTriangle },
    ],
  },
  {
    title: "কাস্টমার সেবা",
    items: [
      { href: "/admin/customers", label: "কাস্টমার খাতা", icon: Users },
      { href: "/admin/customers/new", label: "নতুন কাস্টমার", icon: UserPlus },
      { href: "/admin/measurements", label: "মাপের কার্ড", icon: Ruler },
      { href: "/admin/appointments", label: "অ্যাপয়েন্টমেন্ট", icon: CalendarClock },
    ],
  },
  {
    title: "কারিগর ও কাজ",
    items: [
      { href: "/admin/tasks", label: "কাজ বণ্টন বোর্ড", icon: Scissors },
      { href: "/admin/workers", label: "কারিগর তালিকা", icon: HardHat },
      { href: "/admin/workers/payroll", label: "মজুরি ও পেরোল", icon: Banknote },
    ],
  },
  {
    title: "হিসাব-নিকাশ",
    items: [
      { href: "/admin/payments", label: "পেমেন্ট ও বকেয়া", icon: Wallet },
      { href: "/admin/expenses", label: "দৈনন্দিন খরচ", icon: Receipt },
      { href: "/admin/inventory", label: "কাপড় ও স্টক", icon: Package },
      { href: "/admin/reports", label: "আর্থিক রিপোর্ট", icon: BarChart3 },
    ],
  },
  {
    title: "দোকান ব্যবস্থাপনা",
    items: [
      { href: "/admin/manage", label: "তথ্য যোগ ও সম্পাদনা", icon: Database },
      { href: "/admin/notifications", label: "SMS ও নোটিফিকেশন", icon: MessageSquare },
      { href: "/admin/content", label: "ওয়েবসাইট কনটেন্ট", icon: Globe },
      { href: "/admin/settings", label: "দোকান সেটিংস", icon: Settings },
    ],
  },
];

function RailLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] leading-snug transition-all ${
        collapsed ? "justify-center px-0" : ""
      } ${
        active
          ? "bg-gold font-medium text-ink shadow-xs"
          : "text-white/80 hover:bg-white/8 hover:text-white"
      }`}
    >
      <Icon className={`size-4 shrink-0 ${active ? "text-ink" : "text-gold/80 group-hover:text-gold"}`} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/orders") return pathname === "/admin/orders";
  if (href === "/admin/customers") return pathname === "/admin/customers";
  if (href === "/admin/workers") return pathname === "/admin/workers";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TapeRail({ defaultCollapsed = false }: { defaultCollapsed?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop sidebar collapse — icon-only rail. The initial state comes
  // from the server (cookie), toggles are mirrored onto
  // <body data-admin-sidebar> so the content area's left padding
  // (globals.css .admin-main) follows the rail's width, and saved back
  // to the cookie for the next visit.
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  useEffect(() => {
    document.body.dataset.adminSidebar = collapsed ? "collapsed" : "expanded";
    document.cookie = `admin-sidebar=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);

  return (
    <>
      {/* Desktop Executive Sidebar — collapsible to an icon rail */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 hidden flex-col justify-between border-r border-gold/25 bg-ink text-paper select-none transition-[width] duration-250 lg:flex ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        {/* Top Brand Header + collapse toggle */}
        <div>
          <div className={`flex items-center gap-3 border-b border-white/10 py-3.5 ${collapsed ? "justify-center px-2" : "px-5"}`}>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold/15 text-gold ring-1 ring-gold/40">
              <Logo size={24} />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate font-display text-[16.5px] text-white">রহমান টেইলার্স</div>
                <div className="smallcaps text-[9.5px] text-gold">TailorPro · অ্যাডমিন</div>
              </div>
            )}
            {!collapsed && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                className="size-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="সাইডবার ছোট করুন"
                title="সাইডবার ছোট করুন"
              >
                <PanelLeftClose className="size-4" />
              </Button>
            )}
          </div>
          {collapsed && (
            <div className="flex justify-center border-b border-white/10 py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                className="size-8 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="সাইডবার বড় করুন"
                title="সাইডবার বড় করুন"
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            </div>
          )}

          {/* Navigation — dashboard standalone, then grouped sections */}
          <nav className="px-3 py-2" aria-label="অ্যাডমিন নেভিগেশন">
            <div className="mb-2 space-y-0.5">
              {TOP_ITEMS.map((item) => (
                <RailLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </div>
            {GROUPS.map((group) => (
              <div key={group.title} className="mb-2 last:mb-0">
                {!collapsed && (
                  <div className="smallcaps px-2.5 pt-1.5 pb-1 text-[9.5px] tracking-widest text-white/45">
                    {group.title}
                  </div>
                )}
                {collapsed && <div className="mx-2.5 border-t border-white/10 pt-1.5" aria-hidden />}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <RailLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer — staff entry points only (worker view is not linked from admin) */}
        <div className="border-t border-white/10 bg-black/20 px-4 py-2.5">
          {collapsed ? (
            <form action={logoutStaff} className="flex justify-center">
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="size-8 text-white/75 hover:bg-white/10 hover:text-gold"
                aria-label="লগআউট"
                title="লগআউট"
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <Link
                href="/admin/settings"
                className="inline-flex items-center gap-1.5 text-white/75 transition-colors hover:text-gold"
              >
                <Settings className="size-3.5 text-gold" />
                সেটিংস
              </Link>
              <form action={logoutStaff}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="h-auto gap-1.5 px-1.5 py-1 text-[12.5px] text-white/75 hover:bg-white/10 hover:text-gold"
                >
                  <LogOut className="size-3.5" />
                  লগআউট
                </Button>
              </form>
            </div>
          )}
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
            <div className="grid grid-cols-1 gap-1">
              {TOP_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-[14.5px] ${
                      active ? "bg-gold font-medium text-ink" : "text-white/85 hover:bg-white/10"
                    }`}
                  >
                    <Icon className={`size-4 ${active ? "text-ink" : "text-gold"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
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
