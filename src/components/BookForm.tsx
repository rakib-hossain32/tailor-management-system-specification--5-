"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, Check, ChevronDown, FileDown, X } from "lucide-react";
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
import { matchGarmentName } from "@/lib/garment-match";
import { dateShort, relativeDay } from "@/lib/format";
import { useShop } from "@/components/ShopContext";
import { useMutationFeedback } from "@/components/feedback/FeedbackProvider";

interface Slot {
  start: string;
  label: string;
}

export interface BookGarment {
  id: string;
  nameBn: string;
}

const PURPOSES = ["নতুন মাপ", "ট্রায়াল", "ডেলিভারি/পিকআপ", "পরামর্শ", "অল্টারেশন"];
const DAY_NAMES = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

export function BookForm({
  garments = [],
  initialGarments = [],
}: {
  garments?: BookGarment[];
  /** Names arriving from a service-card link (?garment=…) — preselected. */
  initialGarments?: string[];
}) {
  const shop = useShop();
  const [date, setDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7 && shop.hours.find((row) => row.weekday === d.getDay())?.closed; i++) d.setDate(d.getDate() + 1);
    return d;
  });
  const [calOpen, setCalOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsFor, setSlotsFor] = useState("");
  const [slot, setSlot] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [picked, setPicked] = useState<string[]>(() =>
    // Tolerant resolution (lib/garment-match): a service card may pass a
    // catalog name or a marketing heading containing one.
    Array.from(
      new Set(
        initialGarments
          .map((name) => matchGarmentName(name, garments))
          .filter((name): name is string => name !== null),
      ),
    ),
  );
  const [garmentOpen, setGarmentOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [homeVisit, setHomeVisit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<{ id: string; date: string; slot: string; purpose: string } | null>(null);
  const [msg, setMsg] = useMutationFeedback();

  const iso = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";

  // Closed weekdays come from the shop hours the admin sets — shown as a
  // small note under the section heading, never inside the date field.
  const closedNote = shop.hours
    .filter((row) => row.closed)
    .map((row) => DAY_NAMES[row.weekday])
    .filter(Boolean)
    .join(", ");

  const slotsLoading = Boolean(iso) && slotsFor !== iso;

  useEffect(() => {
    if (!iso) return;
    let alive = true;
    const controller = new AbortController();
    fetch(`/api/v1/public/slots?date=${iso}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (alive) {
          setSlots(d.slots ?? []);
          setSlotsFor(iso);
        }
      })
      .catch(() => {
        if (alive) {
          setSlots([]);
          setSlotsFor(iso);
        }
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [iso]);

  function toggleGarment(nameBn: string) {
    setPicked((current) =>
      current.includes(nameBn) ? current.filter((item) => item !== nameBn) : [...current, nameBn],
    );
  }

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
          garments: picked,
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
        // Slot just filled up or passed — reload the day's slots so the
        // customer can immediately pick another time.
        if (res.status === 409 || res.status === 422) {
          setSlot("");
          setSlots([]);
          setSlotsFor("");
        }
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
          text: `${data.date} · ${data.slot_label} · ${purpose}${picked.length ? ` · বানাতে চান: ${picked.join(", ")}` : ""}। নিচ থেকে অ্যাপয়েন্টমেন্ট কার্ডটি ডাউনলোড করুন।`,
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
    <form onSubmit={submit} className="luxury-card space-y-6 p-4 sm:p-6 lg:p-8">
      {/* ── কবে / কখন আসবেন: date + time slot together, in one place ── */}
      <section aria-labelledby="bk-when" className="space-y-3">
        <div>
          <h2 id="bk-when" className="text-[19px] font-medium leading-snug sm:text-[21px]">
            কবে/কখন আসবেন
          </h2>
          {closedNote && <p className="mt-0.5 text-xs leading-relaxed text-stone">{closedNote} ছুটি</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>তারিখ</Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 w-full justify-between text-base font-normal text-ink"
                >
                  <span className="num">
                    {date ? `${dateShort(date)} (${relativeDay(iso)})` : "তারিখ বাছুন"}
                  </span>
                  <CalendarIcon className="size-4 shrink-0 text-stone" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
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
                  disabled={{ before: today, dayOfWeek: shop.hours.filter((row) => row.closed).map((row) => row.weekday) }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>সময়</Label>
            <Select value={slot} onValueChange={setSlot} disabled={slotsLoading || slots.length === 0}>
              <SelectTrigger aria-label="সময় স্লট" className="min-h-12 w-full text-base">
                <SelectValue
                  placeholder={
                    slotsLoading
                      ? "সময় খোঁজা হচ্ছে…"
                      : slots.length === 0
                        ? "এই তারিখে খালি সময় নেই"
                        : "সময় বেছে নিন"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {slots.map((s) => (
                  <SelectItem key={s.start} value={s.start} className="num min-h-11 text-base">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!slotsLoading && slots.length === 0 && (
              <p className="text-[13px] leading-relaxed text-stone">
                এই তারিখে কোনো খালি সময় নেই — অন্য তারিখ বেছে নিন বা ফোন করুন।
              </p>
            )}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── কী বানাতে চান: multi-select from the admin-managed garment list ── */}
      {garments.length > 0 && (
        <section aria-labelledby="bk-garments" className="space-y-3">
          <div>
            <h2 id="bk-garments" className="text-[19px] font-medium leading-snug sm:text-[21px]">
              কী বানাতে চান
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-stone">এক বা একাধিক বেছে নিতে পারবেন</p>
          </div>

          <Popover open={garmentOpen} onOpenChange={setGarmentOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full justify-between text-base font-normal text-ink"
                aria-label="কী বানাতে চান বেছে নিন"
              >
                <span className={picked.length ? "" : "text-stone"}>
                  {picked.length ? `${picked.length}টি পোশাক বেছে নেওয়া হয়েছে` : "পোশাক বেছে নিন"}
                </span>
                <ChevronDown className="size-4 shrink-0 text-stone" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-1.5">
              <ul className="max-h-72 overflow-y-auto">
                {garments.map((garment) => {
                  const active = picked.includes(garment.nameBn);
                  return (
                    <li key={garment.id}>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => toggleGarment(garment.nameBn)}
                        aria-pressed={active}
                        className="flex min-h-11 w-full items-center justify-start gap-3 rounded-md px-2.5 py-2 text-left text-base font-normal hover:bg-gold-light/50"
                      >
                        <span aria-hidden className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${active ? "border-gold-dark bg-gold text-ink" : "border-ink/40 bg-paper"}`}>{active && <Check className="size-3" />}</span>
                        <span className="flex-1">{garment.nameBn}</span>
                        {active && <Check className="size-4 shrink-0 text-gold-dark" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-ink/10 p-1.5">
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setGarmentOpen(false)}>
                  হয়ে গেছে
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {picked.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="বেছে নেওয়া পোশাক">
              {picked.map((nameBn) => (
                <li
                  key={nameBn}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold-light/40 py-1.5 pl-3.5 pr-2 text-[14.5px]"
                >
                  {nameBn}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleGarment(nameBn)}
                    aria-label={`${nameBn} সরান`}
                    className="size-6 rounded-full hover:bg-gold/25"
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {garments.length > 0 && <Separator />}

      {/* ── উদ্দেশ্য ও যোগাযোগ ── */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <Label>উদ্দেশ্য</Label>
          <Select value={purpose} onValueChange={setPurpose}>
            <SelectTrigger aria-label="উদ্দেশ্য" className="min-h-12 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PURPOSES.map((p) => (
                <SelectItem key={p} value={p} className="min-h-11 text-base">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bk-name">আপনার নাম *</Label>
            <Input id="bk-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার পূর্ণ নাম" className="min-h-12 text-base" />
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
              className="num min-h-12 text-base"
            />
          </div>
        </div>
      </section>

      <Separator />

      <Label htmlFor="bk-home-visit" className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
        <Checkbox
          id="bk-home-visit"
          checked={homeVisit}
          onCheckedChange={(v) => setHomeVisit(v === true)}
          aria-label="হোম ভিজিট"
        />
        হোম ভিজিটের অনুরোধ
      </Label>

      {homeVisit && (
        <div className="space-y-1.5">
          <Label htmlFor="bk-address">বাসার পূর্ণ ঠিকানা</Label>
          <Input
            id="bk-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="বাসা নং, রোড, এলাকা, ঢাকা"
            className="min-h-12 text-base"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="bk-notes">বিশেষ নোট (ঐচ্ছিক)</Label>
        <Textarea
          id="bk-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="কিছু জানাতে চাইলে এখানে লিখুন"
          className="text-base"
        />
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <Button type="submit" variant="gold" size="lg" disabled={busy || !slot} className="min-h-12 w-full text-base sm:w-auto">
          {busy ? "নিশ্চিত করা হচ্ছে…" : "অ্যাপয়েন্টমেন্ট নিশ্চিত করুন"}
        </Button>
        {!slot && <span className="text-[13.5px] text-stone">আগে তারিখ ও সময় বেছে নিন।</span>}
      </div>

      {msg && (
        <div>
          <Alert variant={msg.ok ? "success" : "destructive"}>
            {msg.title && <AlertTitle>{msg.title}</AlertTitle>}
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>

          {msg.ok && booking && (
            <div className="mt-3 rounded-md border border-gold/50 bg-gold-light/40 p-4">
              <div className="smallcaps text-gold-dark">অ্যাপয়েন্টমেন্ট কার্ড</div>
              <p className="mt-1 text-[14.5px] text-ink-3">
                কার্ডে আপনার নাম, ফোন, তারিখ-সময়, উদ্দেশ্য এবং দোকানে স্ক্যান করার বারকোড থাকবে। বাটনে ক্লিক করলেই PDF সরাসরি ডাউনলোড হবে — কোনো প্রিভিউ পেজে যাবে না।
              </p>
              <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <Button asChild variant="gold" className="min-h-11">
                  <a href={`/api/v1/public/appointments/${booking.id}/card`} download>
                    <FileDown className="size-4" />
                    PDF ডাউনলোড করুন
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
