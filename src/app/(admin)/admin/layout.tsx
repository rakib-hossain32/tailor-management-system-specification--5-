import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TapeRail } from "@/components/TapeRail";
import { isAdminRole } from "@/lib/auth";
import { getStaffSession } from "@/lib/access";

export const metadata: Metadata = { title: "অ্যাডমিন প্যানেল" };

/**
 * Admin shell — visually separate from the public site:
 *  - its own warm stone canvas (no public radial gradient)
 *  - navy + gold rail on the left, white ledger cards on top
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();
  if (!session || !isAdminRole(session.role)) redirect("/staff-login?next=/admin");

  return (
    <div className="admin-shell min-h-screen overflow-x-clip bg-[#EFF1F5]">
      <TapeRail />
      <main className="min-w-0 lg:pl-64">
        <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-5 lg:px-7 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
