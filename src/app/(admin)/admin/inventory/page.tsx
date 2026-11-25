import { requireAdminPage } from "@/lib/page-auth";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { fabrics } from "@/db/schema";
import { PageHead, Empty } from "@/components/admin/PageHead";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { addStockMovement } from "../actions";

export const dynamic = "force-dynamic";

const TYPE_BN: Record<string, string> = {
  cotton: "সুতি",
  khaddar: "খাদি",
  silk: "সিল্ক",
  linen: "লিনেন",
  georgette: "জর্জেট",
  wool: "উল",
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;

  const rows = await db.select().from(fabrics).orderBy(asc(fabrics.name));

  const totalValue = rows.reduce((s, f) => s + Number(f.stockQty) * Number(f.costPrice), 0);
  const low = rows.filter((f) => Number(f.stockQty) <= Number(f.reorderLevel));
  const negative = rows.filter((f) => Number(f.stockQty) < 0);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="ইনভেন্টরি"
        title="কাপড় ও স্টক"
        sub="প্রতি গজ/মিটারের ক্রয় ও বিক্রয়মূল্য, বর্তমান স্টক এবং রিঅর্ডার লেভেল। অর্ডারে কাপড় ব্যবহার হলে স্টক থেকে কাটা হয়।"
        actions={
          <Badge variant="secondary" className="h-10 px-4 text-[15px]">
            স্টক মূল্য <b className="num ml-1.5">৳{Math.round(totalValue).toLocaleString("en-US")}</b>
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
              <CardTitle>কাপড়ের তালিকা</CardTitle>
              <CardDescription>মোট {rows.length} ধরন · {low.length}টি লো-স্টক</CardDescription>
            </div>
            {low.length > 0 && <Badge variant="destructive">{low.length}টি কম</Badge>}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>কোড</TableHead>
                  <TableHead>কাপড়</TableHead>
                  <TableHead>ধরন/রং</TableHead>
                  <TableHead>স্টক</TableHead>
                  <TableHead>সীমা</TableHead>
                  <TableHead>ক্রয়</TableHead>
                  <TableHead>বিক্রয়</TableHead>
                  <TableHead className="text-right">স্টক মূল্য</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Empty>কোনো কাপড় যোগ করা হয়নি।</Empty>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((f) => {
                  const qty = Number(f.stockQty);
                  const isLow = qty <= Number(f.reorderLevel);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="num text-stone">{f.code}</TableCell>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-ink-3">
                        {TYPE_BN[f.type] ?? f.type}
                        {f.color ? ` · ${f.color}` : ""}
                      </TableCell>
                      <TableCell className={`num ${isLow ? "font-semibold text-chalk" : ""}`}>
                        {qty} {f.unit === "yard" ? "গজ" : "মিটার"}
                        {isLow && (
                          <Badge variant="destructive" className="ml-2">
                            কম
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="num text-stone">{Number(f.reorderLevel)}</TableCell>
                      <TableCell className="num text-ink-3">{Number(f.costPrice)}</TableCell>
                      <TableCell className="num text-ink-3">{Number(f.sellPrice)}</TableCell>
                      <TableCell className="num text-right">
                        {Math.round(qty * Number(f.costPrice)).toLocaleString("en-US")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {negative.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  সতর্কতা: {negative.map((f) => f.name).join(", ")} — স্টক ঋণাত্মক। মালিকের অনুমোদন ছাড়া ব্লক করা হয় না।
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>স্টক এন্ট্রি</CardTitle>
              <CardDescription>ক্রয় হলে +, ব্যবহার/নষ্ট হলে − লিখুন।</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addStockMovement} className="space-y-3.5">
                <input type="hidden" name="return_path" value="/admin/inventory" />
                <div className="space-y-1.5">
                  <Label>কাপড়</Label>
                  <Select name="fabric_id" required>
                    <SelectTrigger aria-label="কাপড়">
                      <SelectValue placeholder="কাপড় বাছুন…" />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.code} — {f.name} (স্টক {Number(f.stockQty)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-qty">পরিমাণ *</Label>
                  <Input
                    id="inv-qty"
                    name="qty"
                    required
                    inputMode="decimal"
                    placeholder="যেমন 20 বা -3.5"
                    className="num"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-note">নোট (সরবরাহকারী/অর্ডার নং)</Label>
                  <Textarea id="inv-note" name="note" rows={2} required />
                </div>
                <Button type="submit" className="w-full">
                  স্টক আপডেট করুন
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>রিঅর্ডার তালিকা</CardTitle>
            </CardHeader>
            <CardContent>
              {low.length === 0 ? (
                <p className="text-[15px] text-ink-3">✓ সব কাপড়ের স্টক যথেষ্ট।</p>
              ) : (
                <ul className="space-y-2.5 text-[15px]">
                  {low
                    .sort((a, b) => Number(a.stockQty) - Number(b.stockQty))
                    .map((f) => (
                      <li key={f.id} className="flex justify-between gap-3 border-b border-dashed border-stone/50 pb-1.5">
                        <span>{f.name}</span>
                        <span className="num text-chalk">
                          {Number(f.stockQty)} / {Number(f.reorderLevel)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
              <p className="mt-3 text-[13.5px] text-stone">
                সরবরাহকারী: {[...new Set(rows.map((f) => f.supplier).filter(Boolean))].join(" · ") || "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>হিসাবের নিয়ম</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-[14.5px] text-ink-3">
              <p>• স্টক নেগেটিভ হলে সতর্কতা, ব্লক নয়</p>
              <p>• প্রতিটি পরিবর্তন সময় ও কারণসহ লগ হয়</p>
              <p>• কাস্টমারের নিজের কাপড় স্টক থেকে কাটা হয় না</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
