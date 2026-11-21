import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { garmentTypes, settings, tasks, workers } from "@/db/schema";
import { NewOrderForm } from "@/components/NewOrderForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "নতুন অর্ডার" };

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;

  const [garments, workerRows, openTasks, policyRow] = await Promise.all([
    db
      .select()
      .from(garmentTypes)
      .where(eq(garmentTypes.isActive, true))
      .orderBy(asc(garmentTypes.sortOrder)),
    db
      .select()
      .from(workers)
      .where(eq(workers.isActive, true))
      .orderBy(asc(workers.name)),
    db
      .select({ workerId: tasks.workerId })
      .from(tasks)
      .where(inArray(tasks.status, ["assigned", "in_progress", "rework"])),
    db.select().from(settings).where(eq(settings.key, "assignment_policy")).limit(1),
  ]);

  const loadByWorker = new Map<string, number>();
  for (const t of openTasks) {
    if (t.workerId) loadByWorker.set(t.workerId, (loadByWorker.get(t.workerId) ?? 0) + 1);
  }

  const savedMode = ((policyRow[0]?.value as { mode?: string } | undefined)?.mode ?? "auto") as
    | "auto"
    | "manual"
    | "unassigned";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/orders" className="chalk-link text-[14.5px] text-gold-dark">
          ← অর্ডার তালিকা
        </Link>
        <span className="smallcaps text-stone">নতুন অর্ডার উইজার্ড</span>
      </div>

      <header>
        <div className="smallcaps text-stone">তিন ধাপে অর্ডার</div>
        <h1 className="mt-1 text-3xl sm:text-4xl">কাস্টমার → পোশাক ও মাপ → কারিগর বণ্টন ও পেমেন্ট</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-ink-3">
          রিপিট কাস্টমারের ক্ষেত্রে ফোন নম্বর খুঁজলেই সর্বশেষ মাপ স্বয়ংক্রিয়ভাবে যুক্ত হবে এবং কারিগরদের
          কাজের চাপ অনুযায়ী স্বয়ংক্রিয় বা ম্যানুয়াল কাজ বণ্টন করা যাবে।
        </p>
      </header>

      <NewOrderForm
        garments={garments.map((g) => ({
          id: g.id,
          nameBn: g.nameBn,
          basePrice: Number(g.basePrice),
          defaultDeliveryDays: g.defaultDeliveryDays,
          fabricEstimate: g.defaultFabricEstimate ? Number(g.defaultFabricEstimate) : null,
        }))}
        workers={workerRows.map((w) => ({
          id: w.id,
          name: w.name,
          role: w.role,
          activeLoad: loadByWorker.get(w.id) ?? 0,
        }))}
        defaultAssignmentMode={savedMode}
        initialCustomerId={sp.customer}
      />
    </div>
  );
}
