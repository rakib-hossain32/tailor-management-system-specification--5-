import { requireAdminPage } from "@/lib/page-auth";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { PageHead } from "@/components/admin/PageHead";
import { PageGuide } from "@/components/admin/PageGuide";
import { createCustomer } from "./actions";
import { DateField } from "@/components/DateField";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;

  return (
    <div className="space-y-5">
      <Link href="/admin/customers" className="chalk-link text-[14.5px] text-gold-dark">
        ← কাস্টমার খাতা
      </Link>

      <PageHead
        eyebrow="নতুন কাস্টমার"
        title="কাস্টমার তৈরি করুন"
        sub="ফোন নম্বর ইউনিক — একই নম্বরে আগে থেকে কাস্টমার থাকলে সেই প্রোফাইলে নিয়ে যাওয়া হবে। সঙ্গে সঙ্গে প্রথম মাপ প্রোফাইল তৈরি হয়।"
      />

      <PageGuide
        items={[
          ["কেন এই পেজ", "নতুন কাস্টমারের প্রোফাইল খোলা — নাম আর ফোন নম্বরই যথেষ্ট, বাকি তথ্য ঐচ্ছিক।"],
          ["তৈরি হলেই পরের ধাপ", "প্রোফাইল তৈরি হলে সরাসরি তার মাপ যোগ করার পেজে যাওয়া যাবে।"],
          ["এরপর অর্ডার", "মাপ সেভ থাকলে “নতুন অর্ডার” পেজে ফোন খুঁজলেই মাপ নিজে থেকে চলে আসবে।"],
        ]}
      />

      {sp.error && (
        <Alert variant="destructive">
          <AlertTitle>তৈরি হয়নি</AlertTitle>
          <AlertDescription>{sp.error}</AlertDescription>
        </Alert>
      )}
      {sp.ok && (
        <Alert variant="success">
          <AlertDescription>{sp.ok}</AlertDescription>
        </Alert>
      )}

      <form action={createCustomer}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>ব্যক্তিগত তথ্য</CardTitle>
              <CardDescription>নাম ও ফোন ছাড়া বাকি সব ঐচ্ছিক।</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nc-name">নাম *</Label>
                  <Input id="nc-name" name="name" required placeholder="কাস্টমারের নাম" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-phone">ফোন (প্রাইমারি) *</Label>
                  <Input id="nc-phone" name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" className="num" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-alt">বিকল্প ফোন</Label>
                  <Input id="nc-alt" name="alt_phone" inputMode="tel" placeholder="01XXXXXXXXX" className="num" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-email">ইমেইল (ঐচ্ছিক)</Label>
                  <Input id="nc-email" name="email" type="email" placeholder="name@example.com" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nc-address">ঠিকানা</Label>
                <Input id="nc-address" name="address" placeholder="বাসা/রোড/এলাকা, শহর" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>লিঙ্গ</Label>
                  <Select name="gender">
                    <SelectTrigger aria-label="লিঙ্গ">
                      <SelectValue placeholder="নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">পুরুষ</SelectItem>
                      <SelectItem value="female">নারী</SelectItem>
                      <SelectItem value="other">অন্যান্য</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>জন্মতারিখ</Label>
                  <DateField name="birth_date" />
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="nc-profile">প্রথম মাপ প্রোফাইলের নাম</Label>
                <Input id="nc-profile" name="profile_name" defaultValue="নিজে" placeholder="নিজে / ছেলে সাকিব / আব্বু" />
                <p className="text-[13px] text-stone">
                  পরে একই অ্যাকাউন্টে আরও প্রোফাইল (পারিবারিক) যোগ করা যাবে।
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nc-tags">ট্যাগ (কমা দিয়ে)</Label>
                <Input id="nc-tags" name="tags" placeholder="VIP, ঈদ রেগুলার" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nc-notes">নোট</Label>
                <Textarea
                  id="nc-notes"
                  name="notes"
                  rows={3}
                  placeholder="যেমন: প্রতি ঈদে ৩টি পাঞ্জাবি বানান; ডান কাঁধ সামান্য নিচু"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>সংক্ষেপে</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-[15px] text-ink-3">
                <p>• ফোন নম্বর দিয়ে পরে দ্রুত খোঁজা যাবে</p>
                <p>• প্রথম মাপ প্রোফাইল নিজে থেকে তৈরি হবে</p>
                <p>• ট্যাগ দিলে পরে আলাদা করে খোঁজা/মার্কেটিং করা যায়</p>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <Button type="submit" size="lg">
                তৈরি করুন ও মাপ নিন →
              </Button>
              <Button asChild type="button" variant="outline" size="lg">
                <Link href="/admin/customers">বাতিল</Link>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
