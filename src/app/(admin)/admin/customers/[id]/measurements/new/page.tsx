import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  garmentTypes,
  measurementProfiles,
  measurementSets,
  orders,
} from "@/db/schema";
import { MeasurementForm, type LatestSet } from "@/components/MeasurementForm";
import type { MeasurementSchema, StyleSchema } from "@/lib/measurements";

export const dynamic = "force-dynamic";

export default async function NewMeasurementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ profile?: string; garment?: string; return?: string }>;
}) {
  await requireAdminPage();
  const { id: customerId } = await params;
  const sp = await searchParams;
  const returnTo = sp.return && sp.return.startsWith("/") && !sp.return.startsWith("//") ? sp.return : null;

  const profileRows = await db
    .select()
    .from(measurementProfiles)
    .where(eq(measurementProfiles.customerId, customerId));
  if (profileRows.length === 0) notFound();

  const garmentRows = await db
    .select()
    .from(garmentTypes)
    .where(eq(garmentTypes.isActive, true))
    .orderBy(asc(garmentTypes.sortOrder));

  const sets = await db
    .select()
    .from(measurementSets)
    .where(inArray(measurementSets.profileId, profileRows.map((p) => p.id)))
    .orderBy(asc(measurementSets.version));

  const latest: Record<string, LatestSet | undefined> = {};
  for (const s of sets) {
    latest[`${s.profileId}|${s.garmentTypeId}`] = {
      id: s.id,
      version: s.version,
      values: (s.values ?? {}) as Record<string, number>,
      styles: (s.styles ?? {}) as Record<string, string>,
      measuredAt: s.measuredAt.toISOString(),
      source: s.source,
      verified: s.verified,
    };
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={returnTo ?? `/admin/customers/${customerId}`}
          className="chalk-link text-[14.5px] text-gold-dark"
        >
          ← {returnTo ? "অর্ডার উইজার্ডে ফিরে যান" : "কাস্টমার প্রোফাইল"}
        </Link>
        <span className="smallcaps text-stone">মাপ গ্রহণ</span>
      </div>

      <header>
        <div className="smallcaps text-stone">ডিজিটাল মাপ কার্ড</div>
        <h1 className="mt-1 text-3xl sm:text-4xl">নতুন মাপ নিন</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-ink-3">
          ফর্মটি পোশাকের ধরনের <span className="num">measurement_schema</span> থেকে স্বয়ংক্রিয়ভাবে তৈরি।
          সংরক্ষণ সবসময় নতুন ভার্সন — আগেরটি অক্ষত থাকে।
        </p>
      </header>

      <MeasurementForm
        customerId={customerId}
        profiles={profileRows.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          relation: p.relation,
          birthDate: p.birthDate,
          bodyNotes: p.bodyNotes,
        }))}
        garments={garmentRows.map((g) => ({
          id: g.id,
          code: g.code,
          nameBn: g.nameBn,
          category: g.category,
          schema: g.measurementSchema as unknown as MeasurementSchema,
          styleSchema: (g.styleSchema ?? { options: [] }) as unknown as StyleSchema,
          defaultDeliveryDays: g.defaultDeliveryDays,
          basePrice: Number(g.basePrice),
        }))}
        initialProfileId={sp.profile}
        initialGarmentId={sp.garment}
        returnTo={returnTo}
        latest={latest}
      />

    </div>
  );
}
