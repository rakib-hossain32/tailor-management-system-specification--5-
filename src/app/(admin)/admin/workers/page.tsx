import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { HardHat, PlusCircle, UserCheck, UserX } from "lucide-react";
import { db } from "@/db";
import { tasks, workers } from "@/db/schema";
import { PageHead } from "@/components/admin/PageHead";
import { Pagination } from "@/components/admin/Pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createWorker, toggleWorker } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const ROLE_BN: Record<string, string> = {
  cutting: "কাটার",
  stitching: "সেলাই কারিগর",
  finishing: "ফিনিশার",
};

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; ok?: string; error?: string }>;
}) {
  const session = await requireAdminPage();
  const canManage = ["owner", "manager"].includes(session.role);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [allWorkers, openTasks] = await Promise.all([
    db.select().from(workers).orderBy(asc(workers.name)),
    db
      .select({ workerId: tasks.workerId, status: tasks.status, pieceRate: tasks.pieceRate, stage: tasks.stage })
      .from(tasks)
      .where(inArray(tasks.status, ["assigned", "in_progress", "done", "rework", "qc_passed"])),
  ]);

  const stats = new Map<
    string,
    { open: number; done: number; earned: number }
  >();
  for (const w of allWorkers) stats.set(w.id, { open: 0, done: 0, earned: 0 });
  for (const t of openTasks) {
    if (!t.workerId) continue;
    const s = stats.get(t.workerId);
    if (!s) continue;
    if (["assigned", "in_progress", "rework"].includes(t.status)) s.open += 1;
    if (["done", "qc_passed"].includes(t.status)) {
      s.done += 1;
    }
    if (t.status === "qc_passed") s.earned += Number(t.pieceRate ?? 0);
  }

  const totalPages = Math.max(1, Math.ceil(allWorkers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = allWorkers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeCount = allWorkers.filter((w) => w.isActive).length;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="কারিগর ব্যবস্থাপনা"
        title="কারিগর তালিকা"
        sub={`মোট ${allWorkers.length} জন কারিগর (${activeCount} জন সক্রিয়)। নতুন কারিগর যোগ করুন, কাজের চাপ দেখুন এবং মজুরি হিসাব করুন।`}
        actions={
          <>
            {canManage && <Button asChild variant="outline">
              <Link href="/admin/workers/payroll">পেরোল শিট</Link>
            </Button>}
            <Button asChild variant="default">
              <Link href="/admin/tasks">কাজ বণ্টন বোর্ড</Link>
            </Button>
          </>
        }
      />

      {(sp.ok || sp.error) && (
        <Alert variant={sp.error ? "destructive" : "success"}>
          <AlertDescription>{sp.error ?? sp.ok}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        {/* worker table */}
        <Card>
          <CardHeader>
            <CardTitle>কারিগর তালিকা</CardTitle>
            <CardDescription>নামে ক্লিক করলে বিস্তারিত কাজ ও মজুরি দেখা যাবে।</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>কারিগর</TableHead>
                  <TableHead>ধরন</TableHead>
                  <TableHead>দক্ষতা</TableHead>
                  <TableHead>খোলা কাজ</TableHead>
                  <TableHead>সম্পন্ন</TableHead>
                  {canManage && <TableHead>জমা মজুরি</TableHead>}
                  <TableHead className="text-right">অবস্থা</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((w) => {
                  const s = stats.get(w.id) ?? { open: 0, done: 0, earned: 0 };
                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        {canManage ? <Link href={`/admin/workers/${w.id}`} className="chalk-link font-medium">
                          {w.name}
                        </Link> : <span className="font-medium">{w.name}</span>}
                        <span className="num block text-[13px] text-stone">
                          {w.phone ? w.phone.replace("+88", "") : "ফোন নেই"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ROLE_BN[w.role] ?? w.role}</Badge>
                      </TableCell>
                      <TableCell className="text-[13.5px] text-ink-3">
                        {w.skillTags.length ? w.skillTags.join(", ") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.open > 3 ? "destructive" : s.open > 0 ? "gold" : "secondary"}>
                          {s.open}
                        </Badge>
                      </TableCell>
                      <TableCell className="num text-ink-3">{s.done}</TableCell>
                      {canManage && <TableCell className="num font-medium">৳{s.earned.toLocaleString("en-US")}</TableCell>}
                      <TableCell className="text-right">
                        <form action={toggleWorker}>
                          <input type="hidden" name="id" value={w.id} />
                          <Button
                            type="submit"
                            disabled={!canManage}
                            size="sm"
                            variant={w.isActive ? "outline" : "secondary"}
                          >
                            {w.isActive ? (
                              <>
                                <UserCheck className="size-3.5" /> সক্রিয়
                              </>
                            ) : (
                              <>
                                <UserX className="size-3.5" /> নিষ্ক্রিয়
                              </>
                            )}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="-mx-5 mt-2">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                basePath="/admin/workers"
                total={allWorkers.length}
                label="কারিগর"
              />
            </div>
          </CardContent>
        </Card>

        {/* add new worker */}
        {canManage && <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="size-4 text-gold-dark" />
              নতুন কারিগর যোগ করুন
            </CardTitle>
            <CardDescription>
              নতুন কারিগর যোগ করলেই কাজ বণ্টন বোর্ডে তাঁকে বেছে নেওয়া যাবে।
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createWorker} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="w-name">কারিগরের নাম *</Label>
                <Input id="w-name" name="name" required placeholder="যেমন: সোহেল রানা" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="w-phone">মোবাইল নম্বর</Label>
                <Input
                  id="w-phone"
                  name="phone"
                  inputMode="tel"
                  placeholder="01XXXXXXXXX"
                  className="num"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="w-login-email">লগইন ইমেইল (ঐচ্ছিক)</Label>
                <Input id="w-login-email" name="login_email" type="email" autoComplete="off" className="num" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-login-password">লগইন পাসওয়ার্ড (ঐচ্ছিক)</Label>
                <Input id="w-login-password" name="login_password" type="password" minLength={8} autoComplete="new-password" />
                <p className="text-[13px] text-stone">ফোন নম্বর ও অন্তত ৮ অক্ষরের পাসওয়ার্ড দিলে নিজের কাজ দেখার লগইন চালু হবে।</p>
              </div>

              <div className="space-y-1.5">
                <Label>কারিগরের ধরন *</Label>
                <Select name="role" defaultValue="stitching">
                  <SelectTrigger aria-label="কারিগরের ধরন">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cutting">কাটার (কাটিং)</SelectItem>
                    <SelectItem value="stitching">সেলাই কারিগর</SelectItem>
                    <SelectItem value="finishing">ফিনিশার</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>মজুরির ধরন *</Label>
                <Select name="pay_type" defaultValue="piece_rate">
                  <SelectTrigger aria-label="মজুরির ধরন">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="piece_rate">পিস-রেট (প্রতি কাজে)</SelectItem>
                    <SelectItem value="salary">মাসিক বেতন</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="w-salary">মাসিক বেতন (ঐচ্ছিক, শুধু salary হলে)</Label>
                <Input
                  id="w-salary"
                  name="monthly_salary"
                  inputMode="decimal"
                  placeholder="যেমন 18000"
                  className="num"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="w-skills">দক্ষতা (কমা দিয়ে)</Label>
                <Input id="w-skills" name="skill_tags" placeholder="পাঞ্জাবি, শার্ট, কুর্তা" />
              </div>

              <Button type="submit" className="w-full">
                <HardHat className="size-4" />
                কারিগর যোগ করুন
              </Button>
            </form>
          </CardContent>
        </Card>}
      </div>

      <p className="text-[13.5px] text-stone">
        কারিগর কখনো কাস্টমারের ফোন নম্বর, ঠিকানা বা টাকার হিসাব দেখতে পারেন না — তাঁরা শুধু নিজের
        কাজ, মাপ ও ডিজাইন নোট দেখেন।
      </p>
    </div>
  );
}
