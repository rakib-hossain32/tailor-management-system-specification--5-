import { requireAdminPage } from "@/lib/page-auth";
import { asc, desc, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { dateShort, isoDate, startOfToday, taka } from "@/lib/format";
import { addExpense } from "../actions";
import { DateField } from "@/components/DateField";

export const dynamic = "force-dynamic";

const CATEGORIES = ["ভাড়া", "বিদ্যুৎ", "কাপড় ক্রয়", "সুতা-বোতাম", "মজুরি", "যাতায়াত", "ইন্টারনেট/ফোন", "বিবিধ"];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; from?: string }>;
}) {
  await requireAdminPage(true);
  const sp = await searchParams;
  const today = startOfToday();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : isoDate(monthStart);

  const [rows, monthRows] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(gte(expenses.date, from))
      .orderBy(desc(expenses.date), asc(expenses.createdAt))
      .limit(300),
    db
      .select({ category: expenses.category, total: sql<string>`sum(${expenses.amount})` })
      .from(expenses)
      .where(gte(expenses.date, isoDate(monthStart)))
      .groupBy(expenses.category),
  ]);

  const total = rows.reduce((s, e) => s + Number(e.amount), 0);
  const monthTotal = monthRows.reduce((s, r) => s + Number(r.total), 0);
  const maxCat = Math.max(1, ...monthRows.map((r) => Number(r.total)));

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="খরচ"
        title="খরচ ও দৈনন্দিন হিসাব"
        sub="প্রতিটি খরচ ক্যাটাগরি, তারিখ ও রসিদের সঙ্গে রাখা হয় — দিনশেষে ক্যাশ মেলানো সহজ হয়।"
        actions={
          <Badge variant={monthTotal > 0 ? "destructive" : "secondary"} className="h-10 px-4 text-[15px]">
            এ মাসে {taka(monthTotal)}
          </Badge>
        }
      />

      {(sp.ok || sp.error) && (
        <Alert variant={sp.error ? "destructive" : "success"}>
          <AlertDescription>{sp.error ?? sp.ok}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>খরচের তালিকা</CardTitle>
              <CardDescription>তারিখ ধরে ফিল্টার করুন</CardDescription>
            </div>
            <form method="get" className="flex items-center gap-2">
              <DateField name="from" defaultValue={from} placeholder="থেকে" className="h-9 w-[150px]" />
              <Button type="submit" size="sm" variant="secondary">
                দেখুন
              </Button>
            </form>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>ক্যাটাগরি</TableHead>
                  <TableHead>নোট</TableHead>
                  <TableHead>মাধ্যম</TableHead>
                  <TableHead className="text-right">পরিমাণ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Empty>এই সময়ে কোনো খরচ নেই।</Empty>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="num text-ink-3">{dateShort(e.date)}</TableCell>
                    <TableCell className="font-medium">{e.category}</TableCell>
                    <TableCell className="text-ink-3">{e.note ?? "—"}</TableCell>
                    <TableCell className="text-ink-3">
                      {e.method === "cash" ? "ক্যাশ" : e.method.toUpperCase()}
                    </TableCell>
                    <TableCell className="num text-right font-medium text-chalk">
                      − {Number(e.amount).toLocaleString("en-US")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right">
                    মোট ({rows.length}টি এন্ট্রি)
                  </TableCell>
                  <TableCell className="num text-right text-[17px]">{taka(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>নতুন খরচ</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addExpense} className="space-y-3.5">
                <input type="hidden" name="return_path" value="/admin/expenses" />
                <div className="space-y-1.5">
                  <Label>ক্যাটাগরি</Label>
                  <Select name="category" defaultValue="কাপড় ক্রয়">
                    <SelectTrigger aria-label="ক্যাটাগরি">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ex-amount">টাকার পরিমাণ *</Label>
                  <Input id="ex-amount" name="amount" required inputMode="decimal" placeholder="যেমন ২৫০০" className="num" />
                </div>

                <div className="space-y-1.5">
                  <Label>তারিখ</Label>
                  <DateField name="date" defaultValue={isoDate(today)} />
                </div>

                <div className="space-y-1.5">
                  <Label>মাধ্যম</Label>
                  <Select name="method" defaultValue="cash">
                    <SelectTrigger aria-label="মাধ্যম">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">ক্যাশ</SelectItem>
                      <SelectItem value="bkash">bKash</SelectItem>
                      <SelectItem value="nagad">Nagad</SelectItem>
                      <SelectItem value="bank">ব্যাংক</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ex-note">নোট / রসিদ নম্বর</Label>
                  <Textarea id="ex-note" name="note" rows={2} placeholder="যেমন: বিদ্যুৎ বিল নভেম্বর" />
                </div>

                <Button type="submit" className="w-full">
                  খরচ সেভ করুন
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>এ মাসে ক্যাটাগরি অনুযায়ী</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {monthRows.length === 0 && <li className="text-[15px] text-stone">কোনো খরচ নেই।</li>}
                {[...monthRows]
                  .sort((a, b) => Number(b.total) - Number(a.total))
                  .map((r) => (
                    <li key={r.category}>
                      <div className="flex justify-between text-[14.5px]">
                        <span>{r.category}</span>
                        <span className="num">{taka(r.total)}</span>
                      </div>
                      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
                        <div
                          className="h-full rounded-full bg-gold"
                          style={{ width: `${Math.max(6, (Number(r.total) / maxCat) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
