import { MobileActions } from "@/components/public/MobileActions";
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

      <MobileActions />
    </div>
  );
}
