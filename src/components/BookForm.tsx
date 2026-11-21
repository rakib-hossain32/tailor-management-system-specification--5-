"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, FileDown } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { dateShort, relativeDay } from "@/lib/format";

interface Slot {
  start: string;
  label: string;
}

const PURPOSES = ["নতুন মাপ", "ট্রায়াল", "ডেলিভারি/পিকআপ", "পরামর্শ", "অল্টারেশন"];

export function BookForm() {
  const [date, setDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (d.getDay() === 5) d.setDate(d.getDate() + 1);
    return d;
  });
  const [calOpen, setCalOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [homeVisit, setHomeVisit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<{ id: string; date: string; slot: string; purpose: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; title?: string } | null>(null);

  const iso = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";

  useEffect(() => {
    if (!iso) return;
    let alive = true;
    const controller = new AbortController();
    fetch(`/api/v1/public/slots?date=${iso}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setSlots(d.slots ?? []);
      })
      .catch(() => {
        if (alive) setSlots([]);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [iso]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/public/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          purpose,
          date: iso,
          slot,
          location_type: homeVisit ? "home" : "shop",
          address: address || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, title: "বুকিং হয়নি", text: data?.error?.message ?? "আবার চেষ্টা করুন" });
      } else {
        setBooking({
          id: data.id as string,
          date: data.date as string,
          slot: data.slot_label as string,
          purpose,
        });
        setMsg({
          ok: true,
          title: "অ্যাপয়েন্টমেন্ট নিশ্চিত হয়েছে ✓",
          text: `${data.date} · ${data.slot_label} · ${purpose}। নিশ্চিতকরণ SMS পাঠানো হয়েছে — নিচ থেকে কার্ডটি PDF আকারে ডাউনলোড করুন।`,
        });
        setNotes("");
        setSlot("");
      }
    } catch {
      setMsg({ ok: false, title: "নেটওয়ার্ক সমস্যা", text: "আবার চেষ্টা করুন" });
    } finally {
      setBusy(false);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <form onSubmit={submit} className="luxury-card p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>আসার তারিখ (শুক্রবার ছুটি)</Label>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal text-ink"
              >
                <span className="num">
                  {date ? `${dateShort(date)} (${relativeDay(iso)})` : "তারিখ বাছুন"}
                </span>
                <CalendarIcon className="size-4 text-stone" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d && d.getTime() !== date?.getTime()) {
                    setDate(d);
                    setSlot("");
                    setSlots([]);
                  }
                  setCalOpen(false);
                }}
                disabled={{ before: today, dayOfWeek: [5] }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label>উদ্দেশ্য</Label>
          <Select value={purpose} onValueChange={setPurpose}>
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
      </div>

      <div className="mt-5 space-y-2">
        <Label>উপলভ্য সময় স্লট (৩০ মিনিট করে)</Label>
        {slots.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink/20 bg-white/80 px-4 py-3 text-[14.5px] text-stone">
            এই তারিখে কোনো খালি স্লট নেই — অন্য তারিখ বেছে নিন বা ফোন করুন।
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <Button
                key={s.start}
                type="button"
                variant={slot === s.start ? "gold" : "outline"}
                size="sm"
                className="num"
                onClick={() => setSlot(s.start)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bk-name">আপনার নাম *</Label>
          <Input id="bk-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার পূর্ণ নাম" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-phone">মোবাইল নম্বর *</Label>
          <Input
            id="bk-phone"
            required
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="num"
          />
        </div>
      </div>

      <Separator className="my-5" />

      <label className="flex cursor-pointer items-center gap-2.5 text-[14.5px]">
        <Checkbox
          checked={homeVisit}
          onCheckedChange={(v) => setHomeVisit(v === true)}
          aria-label="হোম ভিজিট"
        />
        বিয়ে বা পারিবারিক বড় অর্ডারের জন্য হোম ভিজিট (সিনিয়র মাস্টার বাসায় গিয়ে মাপ নেবেন)
      </label>

      {homeVisit && (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="bk-address">বাসার পূর্ণ ঠিকানা</Label>
          <Input
            id="bk-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="বাসা নং, রোড, এলাকা, ঢাকা"
          />
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="bk-notes">বিশেষ নোট (ঐচ্ছিক)</Label>
        <Textarea
          id="bk-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="যেমন: ২টি শেরওয়ানি ও ৩টি পাঞ্জাবি বানাতে চাই"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="submit" variant="gold" size="lg" disabled={busy || !slot}>
          {busy ? "নিশ্চিত করা হচ্ছে…" : "অ্যাপয়েন্টমেন্ট নিশ্চিত করুন"}
        </Button>
        {!slot && <span className="text-[13.5px] text-stone">উপরে থেকে একটি সময় স্লট নির্বাচন করুন।</span>}
      </div>

      {msg && (
        <div className="mt-4">
          <Alert variant={msg.ok ? "success" : "destructive"}>
            {msg.title && <AlertTitle>{msg.title}</AlertTitle>}
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>

          {msg.ok && booking && (
            <div className="mt-3 rounded-md border border-gold/50 bg-gold-light/40 p-4">
              <div className="smallcaps text-gold-dark">অ্যাপয়েন্টমেন্ট কার্ড</div>
              <p className="mt-1 text-[14.5px] text-ink-3">
                কার্ডে আপনার নাম, ফোন, তারিখ-সময়, উদ্দেশ্য এবং দোকানে স্ক্যান করার QR থাকবে।
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <Button asChild variant="gold">
                  <Link href={`/book/${booking.id}/card?dl=1`}>
                    <FileDown className="size-4" />
                    PDF ডাউনলোড করুন
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/book/${booking.id}/card`}>কার্ড অনলাইনে দেখুন</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
