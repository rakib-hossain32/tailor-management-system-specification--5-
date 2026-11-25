import { getPinnedMeasurementSchemas } from "@/server/repositories/measurement-schema";
import { viewFields } from "@/server/repositories/views";
import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, garmentTypes, measurementProfiles, measurementSets } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { LiveSelectFilter } from "@/components/admin/LiveFilters";
import { ClickableRow } from "@/components/admin/ClickableRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateShort, daysUntil } from "@/lib/format";
import { formatMeasurement } from "@/lib/units";
import { flattenFields, type MeasurementSchema } from "@/lib/measurements";

export const dynamic = "force-dynamic";

const SOURCE_BN: Record<string, string> = {
  in_store: "দোকানে মাপা",
  reused: "পুরনো মাপ",
  fit_adjusted: "ফিট-কারেকশন",
  from_garment: "পোশাক থেকে",
  self_reported: "স্ব-মাপ (অযাচাইকৃত)",
  remote_assisted: "ভিডিও কল",
  standard_size: "স্ট্যান্ডার্ড সাইজ",
};

const SIZE_CHARTS: Record<string, { label: string; values: Record<string, number> }[]> = {
  shirt: [
    { label: "S", values: { chest: 94, length: 70, shoulder: 42, sleeve: 59, neck: 38 } },
    { label: "M", values: { chest: 102, length: 72, shoulder: 44, sleeve: 60, neck: 39 } },
    { label: "L", values: { chest: 110, length: 74, shoulder: 46, sleeve: 61, neck: 40 } },
    { label: "XL", values: { chest: 118, length: 76, shoulder: 48, sleeve: 62, neck: 41 } },
    { label: "XXL", values: { chest: 126, length: 78, shoulder: 50, sleeve: 63, neck: 42 } },
  ],
  pant: [
    { label: "30", values: { waist: 76, hip: 96, length: 100, bottom: 40 } },
    { label: "32", values: { waist: 81, hip: 101, length: 101, bottom: 41 } },
    { label: "34", values: { waist: 86, hip: 106, length: 102, bottom: 42 } },
    { label: "36", values: { waist: 91, hip: 111, length: 103, bottom: 43 } },
    { label: "38", values: { waist: 97, hip: 117, length: 104, bottom: 44 } },
  ],
};

async function loadMeasurementIndex() {
  const [garmentRows, profileRows] = await Promise.all([
    db.select().from(garmentTypes).orderBy(asc(garmentTypes.sortOrder)),
    db.select().from(measurementProfiles).orderBy(asc(measurementProfiles.displayName)),
  ]);
  const garmentById = new Map(garmentRows.map((g) => [g.id, g]));

  const sets = await db
    .select({ s: viewFields(measurementSets), p: viewFields(measurementProfiles), c: viewFields(customers) })
    .from(measurementSets)
    .innerJoin(measurementProfiles, eq(measurementSets.profileId, measurementProfiles.id))
    .innerJoin(customers, eq(measurementProfiles.customerId, customers.id))
    .orderBy(desc(measurementSets.measuredAt))
    .limit(200);
  const schemaById = await getPinnedMeasurementSchemas(sets.map((row) => row.s));
  return { garmentRows, profileRows, garmentById, sets, schemaById, now: Date.now() };
}

export default async function MeasurementsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ garment?: string; stale?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;

  const { garmentRows, profileRows, garmentById, sets, schemaById, now } = await loadMeasurementIndex();

  const filtered = sets.filter((r) => {
    if (sp.garment && sp.garment !== "all" && r.s.garmentTypeId !== sp.garment) return false;
    if (sp.stale === "1") {
      const age = (now - new Date(r.s.measuredAt).getTime()) / 86_400_000;
      if (age < 365) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="মাপ ব্যবস্থাপনা"
        title="মাপের কার্ড ও সংস্করণ"
        sub="প্রতিটি মাপ অপরিবর্তনীয় — সংশোধন মানে নতুন ভার্সন। নিচে সব সাম্প্রতিক মাপ এবং স্ট্যান্ডার্ড সাইজ চার্ট।"
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/customers">কাস্টমার থেকে মাপ নিন</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-[220px]">
              <LiveSelectFilter
                param="garment"
                value={sp.garment ?? "all"}
                params={sp.stale ? { stale: sp.stale } : {}}
                options={[
                  { value: "all", label: "সব পোশাক" },
                  ...garmentRows.map((g) => ({ value: g.id, label: g.nameBn })),
                ]}
                ariaLabel="পোশাক ফিল্টার"
                placeholder="সব পোশাক"
              />
            </div>
            <div className="w-[220px]">
              <LiveSelectFilter
                param="stale"
                value={sp.stale ?? "all"}
                params={sp.garment ? { garment: sp.garment } : {}}
                options={[
                  { value: "all", label: "সব সময়ের মাপ" },
                  { value: "1", label: "১ বছরের বেশি পুরনো" },
                ]}
                ariaLabel="বয়স ফিল্টার"
                placeholder="সব বয়সের মাপ"
              />
            </div>
            <Button asChild type="button" variant="outline">
              <Link href="/admin/measurements">রিসেট</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>সাম্প্রতিক মাপ ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>কাস্টমার / প্রোফাইল</TableHead>
                <TableHead>পোশাক</TableHead>
                <TableHead>সংস্করণ</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead>উৎস</TableHead>
                <TableHead>প্রধান মাপ (ইঞ্চি)</TableHead>
                <TableHead>অবস্থা</TableHead>
                <TableHead className="text-right">কার্ড</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Empty>কোনো মাপ পাওয়া যায়নি।</Empty>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(({ s, p, c }) => {
                const g = garmentById.get(s.garmentTypeId);
                const schema = schemaById.get(s.garmentSchemaVersionId)?.measurementSchema as unknown as MeasurementSchema | undefined;
                const brief = flattenFields(schema).slice(0, 4);
                const age = daysUntil(s.measuredAt);
                const stale = age !== null && Math.abs(age) > 365;
                return (
                  <ClickableRow key={s.id} href={`/admin/customers/${c.id}?tab=measurements`}>
                    <TableCell>
                      <Link href={`/admin/customers/${c.id}?tab=measurements`} className="chalk-link font-medium">
                        {c.name}
                      </Link>
                      <span className="block text-[13px] text-stone">প্রোফাইল: {p.displayName}</span>
                    </TableCell>
                    <TableCell>{g?.nameBn ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.isCurrent ? "default" : "outline"} className="num">
                        v{s.version}
                      </Badge>
                    </TableCell>
                    <TableCell className="num text-ink-3">{dateShort(s.measuredAt)}</TableCell>
                    <TableCell className="text-[13.5px] text-ink-3">{SOURCE_BN[s.source] ?? s.source}</TableCell>
                    <TableCell className="text-[13.5px] text-ink-3">
                      {brief
                        .map(
                          (f) =>
                            `${f.label_bn} ${formatMeasurement((s.values as Record<string, number>)?.[f.key], "inch")}`,
                        )
                        .join(", ")}
                    </TableCell>
                    <TableCell>
                      {s.verified ? (
                        <Badge variant="success">✓ যাচাইকৃত</Badge>
                      ) : stale ? (
                        <Badge variant="destructive">পুরনো — আবার মাপুন</Badge>
                      ) : (
                        <Badge variant="gold">অযাচাইকৃত</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/api/v1/admin/measurements/${s.id}/card`}>কার্ড PDF</Link>
                      </Button>
                    </TableCell>
                  </ClickableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>স্ট্যান্ডার্ড সাইজ চার্ট</CardTitle>
          <CardDescription>
            সহজ পোশাকের জন্য রেফারেন্স চার্ট — মোট প্রোফাইল {profileRows.length}টি।
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {Object.entries(SIZE_CHARTS).map(([code, sizes]) => {
            const g = garmentRows.find((x) => x.code === code);
            const schema = g?.measurementSchema as unknown as MeasurementSchema | undefined;
            const fields = flattenFields(schema);
            return (
              <div key={code}>
                <h3 className="mb-2 text-[18px] font-medium">{g?.nameBn ?? code}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>সাইজ</TableHead>
                      {fields.slice(0, 5).map((f) => (
                        <TableHead key={f.key}>{f.label_bn}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sizes.map((s) => (
                      <TableRow key={s.label}>
                        <TableCell className="num font-medium">{s.label}</TableCell>
                        {fields.slice(0, 5).map((f) => (
                          <TableCell key={f.key} className="num text-ink-3">
                            {s.values[f.key] ? formatMeasurement(s.values[f.key], "inch") : "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
