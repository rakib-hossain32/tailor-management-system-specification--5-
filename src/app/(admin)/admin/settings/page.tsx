import { requireAdminPage } from "@/lib/page-auth";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { garmentTypes, settings, users, tasks, workers } from "@/db/schema";
import { PageHead } from "@/components/admin/PageHead";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { flattenFields, type MeasurementSchema, type StyleSchema } from "@/lib/measurements";
import { updateShopInfo } from "../actions";

export const dynamic = "force-dynamic";

const ROLE_BN: Record<string, string> = {
  owner: "মালিক",
  manager: "ম্যানেজার",
  reception: "রিসেপশন",
  master: "মাস্টার",
};

const STAGE_BN: Record<string, string> = {
  cutting: "কাটিং",
  stitching: "সেলাই",
  finishing: "ফিনিশিং",
  buttoning: "বোতাম",
  alteration: "সংশোধন",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdminPage(true);
  const sp = await searchParams;

  const [shopRows, garmentRows, userRows, wageRows] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, "shop")).limit(1),
    db.select().from(garmentTypes).orderBy(asc(garmentTypes.sortOrder)),
    db.select().from(users).orderBy(asc(users.name)),
    db
      .select({ worker: workers.name, stage: tasks.stage, rate: sql<string>`avg(${tasks.pieceRate})` })
      .from(tasks)
      .innerJoin(workers, eq(tasks.workerId, workers.id))
      .where(sql`${tasks.pieceRate} is not null`)
      .groupBy(workers.name, tasks.stage)
      .orderBy(asc(workers.name)),
  ]);

  const shop = (shopRows[0]?.value ?? {}) as Record<string, string>;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="সেটিংস"
        title="দোকান, পোশাক ও ব্যবহারকারী"
        sub="এখানে যা বদলালে কোড বদলাতে হয় না — ইনভয়েস, মাপের স্কিমা, মজুরি রেট ও ভূমিকা সব কনফিগারযোগ্য।"
      />

      {(sp.ok || sp.error) && (
        <Alert variant={sp.error ? "destructive" : "success"}>
          <AlertDescription>{sp.error ?? sp.ok}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>দোকানের তথ্য</CardTitle>
            <CardDescription>ইনভয়েস ও পাবলিক সাইটে এই তথ্যই দেখা যাবে।</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateShopInfo} className="space-y-3.5">
              <input type="hidden" name="return_path" value="/admin/settings" />
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="st-name-bn">নাম (বাংলা) *</Label>
                  <Input id="st-name-bn" name="name_bn" defaultValue={shop.name_bn ?? ""} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-name-en">নাম (ইংরেজি)</Label>
                  <Input id="st-name-en" name="name_en" defaultValue={shop.name_en ?? ""} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-tagline">ট্যাগলাইন</Label>
                <Input id="st-tagline" name="tagline" defaultValue={shop.tagline ?? ""} />
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="st-address">ঠিকানা</Label>
                  <Input id="st-address" name="address" defaultValue={shop.address ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-phone">ফোন</Label>
                  <Input id="st-phone" name="phone" defaultValue={shop.phone ?? ""} className="num" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-hours">কর্মঘণ্টা</Label>
                <Input id="st-hours" name="hours" defaultValue={shop.hours ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-footer">ইনভয়েস ফুটার</Label>
                <Textarea id="st-footer" name="invoice_footer" rows={2} defaultValue={shop.invoice_footer ?? ""} />
              </div>
              <Button type="submit">সেভ করুন</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>ব্যবহারকারী ও ভূমিকা (RBAC)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-ink/10">
                {userRows.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5 text-[15px]">
                    <span className="flex size-9 items-center justify-center rounded-full bg-gold-light text-[15px] font-semibold text-gold-dark">
                      {u.name.charAt(0)}
                    </span>
                    <span className="flex-1">
                      {u.name}
                      <span className="num block text-[13px] text-stone">{u.phone.replace("+88", "")}</span>
                    </span>
                    <Badge variant="outline">{ROLE_BN[u.role] ?? u.role}</Badge>
                    <Badge variant={u.isActive ? "success" : "secondary"}>
                      {u.isActive ? "সক্রিয়" : "নিষ্ক্রিয়"}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[13.5px] text-stone">
                পারমিশন কোডে হার্ডকোড নয় — roles/permissions টেবিলে রাখার জন্য প্রস্তুত (order.create,
                measurement.edit, payment.create, report.financial.view …)।
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>মজুরি রেট (গড়, পিস)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-[15px]">
                {wageRows.map((w) => (
                  <li
                    key={`${w.worker}-${w.stage}`}
                    className="flex justify-between border-b border-dashed border-stone/50 pb-1.5"
                  >
                    <span>
                      {w.worker} · {STAGE_BN[w.stage] ?? w.stage}
                    </span>
                    <span className="num">৳{Math.round(Number(w.rate))}</span>
                  </li>
                ))}
                {wageRows.length === 0 && <li className="text-stone">কোনো রেকর্ড নেই।</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>পোশাক ও মাপের স্কিমা</CardTitle>
          <CardDescription>
            নতুন পোশাক যোগ করলে কোড বদলাতে হবে না — স্কিমা JSON থেকে ফর্ম নিজে থেকে তৈরি হয়।
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>কোড</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead>ক্যাটাগরি</TableHead>
                <TableHead>মাপ ফিল্ড</TableHead>
                <TableHead>স্টাইল</TableHead>
                <TableHead>মূল্য</TableHead>
                <TableHead>দিন</TableHead>
                <TableHead>অবস্থা</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {garmentRows.map((g) => {
                const schema = g.measurementSchema as unknown as MeasurementSchema;
                const styleSchema = (g.styleSchema ?? { options: [] }) as unknown as StyleSchema;
                const fields = flattenFields(schema);
                return (
                  <TableRow key={g.id}>
                    <TableCell className="code text-stone">{g.code}</TableCell>
                    <TableCell className="font-medium">{g.nameBn}</TableCell>
                    <TableCell className="text-ink-3">{g.category}</TableCell>
                    <TableCell>
                      <span className="num mr-2">{fields.length}</span>
                      <span className="text-[13px] text-stone">
                        {fields.slice(0, 6).map((f) => f.label_bn).join(", ")}
                        {fields.length > 6 && "…"}
                      </span>
                    </TableCell>
                    <TableCell className="num text-ink-3">{styleSchema.options.length}</TableCell>
                    <TableCell className="num">{Number(g.basePrice).toLocaleString("en-US")}</TableCell>
                    <TableCell className="num">{g.defaultDeliveryDays}</TableCell>
                    <TableCell>
                      <Badge variant={g.isActive ? "success" : "secondary"}>
                        {g.isActive ? "সক্রিয়" : "বন্ধ"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["অর্ডার নম্বর ফরম্যাট", "TP-YYMM-NNNN (মাসভিত্তিক, অ্যাডভাইজরি লকসহ)"],
          ["ডিফল্ট ডেলিভারি", "পোশাকভিত্তিক দিন — নতুন অর্ডারে অটো-ফিল"],
          ["মাপ পুরনো হওয়ার সীমা", "১২ মাস (বাচ্চার মাপ ৩ মাস) — সতর্কতা দেখায়"],
          ["ডেলিভারি ক্যাপাসিটি", "দিনে ৬+ অর্ডার হলে নতুন অর্ডারে সতর্কতা"],
        ].map(([t, d]) => (
          <Card key={t}>
            <CardContent className="pt-5">
              <div className="smallcaps text-stone">{t}</div>
              <p className="mt-1.5 text-[15px]">{d}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
