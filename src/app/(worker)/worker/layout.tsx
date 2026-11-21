import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Banknote, Smartphone, LogOut } from "lucide-react";
import { getStaffSession } from "@/lib/access";
import { logoutStaff } from "@/app/(public)/staff-login/actions";
import { Logo } from "@/components/Logo";

/**
 * Worker view — its own shell, deliberately separate from the admin panel.
 * Workers never see customer phone numbers, dues or payroll of others.
 */
export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  if (!session || session.role !== "worker") redirect("/staff-login?next=/worker");

  return (
    <div className="admin-shell min-h-screen bg-[#EFF1F5]">
      <header className="no-print sticky top-0 z-40 border-b border-gold/40 bg-ink text-paper">
        <div className="mx-auto flex max-w-[900px] items-center gap-3 px-4 py-3">
          <Link href="/worker" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold/15 text-gold ring-1 ring-gold/40">
              <Logo size={22} />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-[17px] text-white">
                কারিগর ভিউ
              </span>
              <span className="smallcaps block truncate text-[9.5px] text-gold">
                রহমান টেইলার্স · শুধু আমার কাজ
              </span>
            </span>
          </Link>

          <nav className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link
              href="/worker"
              className="rounded-md bg-white/10 px-3 py-2 text-[14px] text-white hover:bg-white/20"
            >
              <ClipboardList className="mr-1.5 inline size-4 text-gold" />
              কাজ
            </Link>
            <Link
              href="/worker/earnings"
              className="rounded-md px-3 py-2 text-[14px] text-white/85 hover:bg-white/10"
            >
              <Banknote className="mr-1.5 inline size-4 text-gold" />
              আয়
            </Link>
            <form action={logoutStaff}>
              <button
                type="submit"
                className="rounded-md px-3 py-2 text-[14px] text-white/70 hover:bg-white/10"
              >
                <LogOut className="mr-1.5 inline size-4 text-gold" />
                লগআউট
              </button>
            </form>
          </nav>
        </div>
        <div className="ticks-h h-1.5 opacity-70" aria-hidden />
      </header>

      <main className="mx-auto max-w-[900px] px-4 py-5">{children}</main>

      <footer className="no-print mt-6 border-t border-ink/10 bg-white/60 py-5 text-center text-[13px] text-stone">
        <p className="flex items-center justify-center gap-1.5">
          <Smartphone className="size-3.5 text-gold-dark" />
          এখানে কাস্টমারের ফোন, ঠিকানা বা টাকার তথ্য দেখা যায় না।
        </p>
        <p className="mt-1">
          সমস্যা হলে ম্যানেজারকে জানান · হটলাইন{" "}
          <a href="tel:+8801711000001" className="num text-gold-dark">
            ০১৭১১-০০০০০১
          </a>
        </p>
      </footer>
    </div>
  );
}
