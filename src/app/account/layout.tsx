import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { getCustomerSession } from "@/lib/access";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";

export const dynamic = "force-dynamic";

const TABS: [string, string][] = [
  ["/account", "ওভারভিউ"],
  ["/account/orders", "আমার অর্ডার"],
  ["/account/measurements", "আমার মাপ"],
  ["/account/profile", "প্রোফাইল"],
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  if (!session) redirect("/login");
  const id = session.customerId;

  const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (rows.length === 0) redirect("/login");
  const c = rows[0];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="border-b border-ink/10 bg-paper-2/70">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-end gap-4 px-4 pt-6 pb-3 sm:px-6">
            <div>
              <div className="smallcaps text-stone">কাস্টমার পোর্টাল</div>
              <h1 className="mt-1 text-[30px] sm:text-[36px]">{c.name}</h1>
              <p className="num text-[14.5px] text-ink-3">{c.phone.replace("+88", "")}</p>
            </div>
            <form
              action={async () => {
                "use server";
                const { redirect: rd } = await import("next/navigation");
                const { cookies: ck } = await import("next/headers");
                const jar2 = await ck();
                jar2.set("portal_session", "", { path: "/", maxAge: 0 });
                rd("/login");
              }}
              className="ml-auto"
            >
              <button className="rounded-sm border border-ink/30 px-4 py-2.5 text-[15px] hover:bg-ink/5">
                লগআউট
              </button>
            </form>
          </div>
          <nav className="mx-auto flex max-w-[1200px] gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
            {TABS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="shrink-0 rounded-full border border-ink/25 px-4 py-1.5 text-[15px] hover:bg-ink/5"
              >
                {label}
              </Link>
            ))}
            <Link href="/track" className="shrink-0 rounded-full border border-ink/25 px-4 py-1.5 text-[15px] hover:bg-ink/5">
              ট্র্যাকিং
            </Link>
          </nav>
        </div>

        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
