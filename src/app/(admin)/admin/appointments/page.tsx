import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { appointments, garmentTypes } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateBn, isoDate, startOfToday } from "@/lib/format";
import { createAppointment, setAppointmentStatus } from "../actions";
import { garmentsByAppointment } from "@/server/services/appointment-garments";
import { DateField } from "@/components/DateField";

export const dynamic = "force-dynamic";

const PURPOSES = ["নতুন মাপ", "ট্রায়াল", "ডেলিভারি/পিকআপ", "পরামর্শ", "অল্টারেশন"];

const STATUS: Record<string, { label: string; variant: "secondary" | "info" | "success" | "destructive" | "outline" }> = {
  booked: { label: "বুকড", variant: "secondary" },
  confirmed: { label: "নিশ্চিত", variant: "info" },
  done: { label: "সম্পন্ন", variant: "success" },
  no_show: { label: "এসেন", variant: "destructive" },
  cancelled: { label: "বাতিল", variant: "outline" },
};

function timeLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? "সকাল" : h < 16 ? "দুপুর" : h < 19 ? "বিকাল" : "রাত";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

const TIME_SLOTS = Array.from({ length: 22 }, (_, i) => {
  const h = 10 + Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; ok?: string; error?: string; focus?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : isoDate(startOfToday());

  // QR scan target: /admin/appointments?focus=<id> — that appointment is
  // loaded whatever day it belongs to and pinned, highlighted, at the top.
  const focusRow =
    sp.focus && /^[a-f\d-]{36}$/i.test(sp.focus)
      ? (await db.select().from(appointments).where(eq(appointments.id, sp.focus)).limit(1))[0] ?? null
      : null;
  const focusGarments = focusRow ? await garmentsByAppointment([focusRow.id]) : null;

  const garmentRows = await db
    .select({ nameBn: garmentTypes.nameBn })
    .from(garmentTypes)
    .where(eq(garmentTypes.isActive, true))
    .orderBy(garmentTypes.sortOrder);

  const rows = await db
    .select()
    .from(appointments)
    .where(
      and(
        gte(appointments.startsAt, new Date(`${date}T00:00:00`)),
        lt(appointments.startsAt, new Date(`${date}T23:59:59`)),
      ),
    )
    .orderBy(appointments.startsAt);

  const garmentsMap = await garmentsByAppointment(rows.map((r) => r.id));

  const shift = (n: number) => {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  };

  const counts = {
    total: rows.length,
    confirmed: rows.filter((r) => r.status === "confirmed" || r.status === "booked").length,
    done: rows.filter((r) => r.status === "done").length,
  };

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="অ্যাপয়েন্টমেন্ট"
        title="ক্যালেন্ডার ও স্লট"
        sub="কাস্টমার অনলাইনে বুক করে বা রিসেপশন ফোনে নেন। প্রতি স্লট ৩০ মিনিট, শুক্রবার ছুটি।"
        actions={
          <Button asChild variant="outline">
            <Link href="/book">পাবলিক বুকিং পেজ ↗</Link>
          </Button>
        }
      />

      {(sp.ok || sp.error) && (
        <Alert variant={sp.error ? "destructive" : "success"}>
          <AlertDescription>{sp.error ?? sp.ok}</AlertDescription>
        </Alert>
      )}

      {focusRow && (
        <Card className="border-2 border-gold bg-gold-light/30">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2.5">
              QR স্ক্যান থেকে পাওয়া অ্যাপয়েন্টমেন্ট
              <Badge variant={(STATUS[focusRow.status] ?? STATUS.booked).variant}>
                {(STATUS[focusRow.status] ?? STATUS.booked).label}
              </Badge>
            </CardTitle>
            <CardDescription>
              {focusRow.name} · <span className="num">{focusRow.phone.replace("+88", "")}</span> ·{" "}
              {dateBn(focusRow.startsAt)} · {timeLabel(new Date(focusRow.startsAt))} · {focusRow.purpose}
              {(focusGarments?.get(focusRow.id)?.length ?? 0) > 0 &&
                ` · বানাতে চান: ${(focusGarments?.get(focusRow.id) ?? []).join(", ")}`}
              {focusRow.customerId && (
                <>
                  {" · "}
                  <Link href={`/admin/customers/${focusRow.customerId}?tab=measurements`} className="chalk-link font-medium">
                    কাস্টমারের মাপ ও অর্ডার খুলুন →
                  </Link>
                </>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      {sp.focus && !focusRow && (
        <Alert variant="destructive">
          <AlertDescription>QR-এর অ্যাপয়েন্টমেন্টটি পাওয়া যায়নি — মুছে ফেলা হয়ে থাকতে পারে।</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/appointments?date=${shift(-1)}`}>← আগের দিন</Link>
          </Button>
          <div className="text-center">
            <div className="smallcaps text-stone">নির্বাচিত দিন</div>
            <div className="text-[19px]">{dateBn(date)}</div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/appointments?date=${shift(1)}`}>পরের দিন →</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/admin/appointments?date=${isoDate(startOfToday())}`}>আজ</Link>
          </Button>
          <div className="ml-auto flex gap-5 text-[14.5px]">
            <span>
              মোট <b className="num">{counts.total}</b>
            </span>
            <span>
              নিশ্চিত <b className="num">{counts.confirmed}</b>
            </span>
            <span>
              সম্পন্ন <b className="num">{counts.done}</b>
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>দিনের তালিকা</CardTitle>
            <CardDescription>সময় অনুযায়ী সাজানো</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>সময়</TableHead>
                  <TableHead>কাস্টমার</TableHead>
                  <TableHead>উদ্দেশ্য</TableHead>
                  <TableHead>অবস্থা</TableHead>
                  <TableHead className="text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Empty>এই দিনে কোনো অ্যাপয়েন্টমেন্ট নেই।</Empty>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((a) => {
                  const st = STATUS[a.status] ?? STATUS.booked;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="num whitespace-nowrap font-medium">
                        {timeLabel(new Date(a.startsAt))}
                      </TableCell>
                      <TableCell>
                        <div>{a.name}</div>
                        <div className="num text-[13px] text-stone">{a.phone.replace("+88", "")}</div>
                        {a.notes && <div className="text-[13px] text-stone">{a.notes}</div>}
                      </TableCell>
                      <TableCell className="text-ink-3">
                        {a.purpose}
                        {(garmentsMap.get(a.id)?.length ?? 0) > 0 && (
                          <div className="mt-1 text-[13px] text-stone">
                            বানাতে চান: {(garmentsMap.get(a.id) ?? []).join(", ")}
                          </div>
                        )}
                        {a.locationType === "home" && (
                          <Badge variant="gold" className="ml-2">
                            হোম ভিজিট
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {["confirmed", "done", "no_show", "cancelled"].map((s) =>
                            s === a.status ? null : (
                              <form key={s} action={setAppointmentStatus}>
                                <input type="hidden" name="id" value={a.id} />
                                <input type="hidden" name="status" value={s} />
                                <input
                                  type="hidden"
                                  name="return_path"
                                  value={`/admin/appointments?date=${date}`}
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant={
                                    s === "confirmed"
                                      ? "default"
                                      : s === "done"
                                        ? "outline"
                                        : "ghost"
                                  }
                                  className={s === "cancelled" || s === "no_show" ? "text-chalk" : ""}
                                >
                                  {s === "confirmed"
                                    ? "নিশ্চিত"
                                    : s === "done"
                                      ? "সম্পন্ন"
                                      : s === "no_show"
                                        ? "এসেন"
                                        : "বাতিল"}
                                </Button>
                              </form>
                            ),
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>নতুন অ্যাপয়েন্টমেন্ট (রিসেপশন)</CardTitle>
            <CardDescription>অনলাইন বুকিংও এখানেই আসে।</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAppointment} className="space-y-3.5">
              <input type="hidden" name="return_path" value={`/admin/appointments?date=${date}`} />
              <div className="space-y-1.5">
                <Label htmlFor="ap-name">নাম *</Label>
                <Input id="ap-name" name="name" required placeholder="কাস্টমারের নাম" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-phone">ফোন *</Label>
                <Input id="ap-phone" name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" className="num" />
              </div>
              <div className="space-y-1.5">
                <Label>উদ্দেশ্য</Label>
                <Select name="purpose" defaultValue="নতুন মাপ">
                  <SelectTrigger aria-label="উদ্দেশ্য">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {garmentRows.length > 0 && (
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium">কী বানাতে চান</legend>
                  <p className="text-xs text-stone">একাধিক বেছে নেওয়া যাবে — তালিকাটি “ব্যবস্থাপনা → পোশাক ও মাপ” থেকে আসে।</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {garmentRows.map((g, gi) => (
                      <label key={g.nameBn} htmlFor={`gm-${gi}`} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-sm has-[[data-state=checked]]:border-gold has-[[data-state=checked]]:bg-gold-light/50">
                        <Checkbox id={`gm-${gi}`} name="garments" value={g.nameBn} className="size-3.5" />
                        {g.nameBn}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="space-y-1.5">
                <Label>তারিখ</Label>
                <DateField name="date" defaultValue={date} />
              </div>
              <div className="space-y-1.5">
                <Label>সময়</Label>
                <Select name="time" defaultValue="11:00">
                  <SelectTrigger aria-label="সময়" className="num">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {timeLabel(new Date(`2000-01-01T${t}:00`))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-notes">নোট</Label>
                <Textarea id="ap-notes" name="notes" rows={2} placeholder="ঐচ্ছিক" />
              </div>
              <Button type="submit" className="w-full">
                যোগ করুন
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
