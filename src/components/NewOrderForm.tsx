"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutationError } from "@/components/feedback/FeedbackProvider";
import { requestJson } from "@/lib/client-api";
import Link from "next/link";
import { CalendarIcon, Sparkles, UserCheck, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { dateShort, relativeDay } from "@/lib/format";

interface Garment {
  id: string;
  nameBn: string;
  basePrice: number;
  defaultDeliveryDays: number;
  fabricEstimate: number | null;
}

interface WorkerOption {
  id: string;
  name: string;
  role: string;
  activeLoad: number;
}

interface CustomerHit {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  tags: string[];
  open_due: number;
  order_count: number;
}

interface Profile {
  id: string;
  display_name: string;
  relation: string | null;
  is_default: boolean;
  sets: {
    id: string;
    garment_type_id: string;
    version: number;
    measured_at: string;
    source: string;
    verified: boolean;
  }[];
}

interface Line {
  key: number;
  garmentId: string;
  qty: number;
  price: number;
  fabricSource: "shop" | "customer";
  fabricQty: string;
  notes: string;
}

function ageDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

interface OrderDraft {
  customer?: CustomerHit | null;
  profileId?: string;
  lines?: Line[];
  delivery?: string;
  discount?: string;
  advance?: string;
  notes?: string;
  priority?: "normal" | "urgent";
  assignmentMode?: "auto" | "manual" | "unassigned";
  method?: string;
  manualWorkers?: { cutting: string; stitching: string; finishing: string };
}

interface NewOrderFormProps {
  garments: Garment[];
  workers?: WorkerOption[];
  defaultAssignmentMode?: "auto" | "manual" | "unassigned";
  initialCustomerId?: string;
}

function newLine(garment: Garment, key: number): Line {
  return {
    key,
    garmentId: garment.id,
    qty: 1,
    price: Number(garment.basePrice),
    fabricSource: "shop",
    fabricQty: garment.fabricEstimate == null ? "" : String(garment.fabricEstimate),
    notes: "",
  };
}

export function NewOrderForm(props: NewOrderFormProps) {
  if (!props.garments.length) return <div className="paper-card p-6"><p>অর্ডার তৈরির আগে পোশাকের ধরন যোগ করুন।</p><Link href="/admin/manage" className="mt-3 inline-block text-gold-dark">তথ্য ব্যবস্থাপনা</Link></div>;
  return <OrderDraftLoader key={props.initialCustomerId || "saved-draft"} {...props} />;
}

function OrderDraftLoader(props: NewOrderFormProps) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; draft: OrderDraft | null; error?: string }>(
    { status: props.initialCustomerId ? "ready" : "loading", draft: null },
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (props.initialCustomerId) return;
    const controller = new AbortController();
    let alive = true;
    requestJson<{ draft: OrderDraft | null }>("/api/v1/drafts", { signal: controller.signal })
      .then((result) => { if (alive) setState({ status: "ready", draft: result.draft }); })
      .catch((error: Error) => { if (alive) { setState({ status: "error", draft: null, error: error.message }); toast.error(error.message); } });
    return () => { alive = false; controller.abort(); };
  }, [props.initialCustomerId, attempt]);
  if (state.status === "loading") return <div className="paper-card p-6" role="status">অর্ডার ফর্ম খোলা হচ্ছে…</div>;
  if (state.status === "error") return <div className="paper-card p-6"><p>{state.error}</p><Button className="mt-4" onClick={() => { setState({ status: "loading", draft: null }); setAttempt((value) => value + 1); }}>আবার চেষ্টা করুন</Button></div>;
  return <NewOrderFields {...props} draft={state.draft} />;
}

function NewOrderFields({
  garments,
  workers = [],
  defaultAssignmentMode = "auto",
  initialCustomerId,
  draft,
}: NewOrderFormProps & { draft: OrderDraft | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [customer, setCustomer] = useState<CustomerHit | null>(draft?.customer ?? null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState(draft?.profileId ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    draft?.customer ? (draft.lines?.length ? draft.lines : [newLine(garments[0], 1)]) : [],
  );
  const [delivery, setDelivery] = useState<Date | undefined>(() => {
    if (draft?.delivery) return new Date(`${draft.delivery}T00:00:00`);
    const d = new Date();
    d.setDate(d.getDate() + garments[0].defaultDeliveryDays);
    return d;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [priority, setPriority] = useState<"normal" | "urgent">(draft?.priority ?? "normal");
  const [assignmentMode, setAssignmentMode] = useState<"auto" | "manual" | "unassigned">(
    draft?.assignmentMode ?? defaultAssignmentMode,
  );
  const [manualWorkers, setManualWorkers] = useState<{
    cutting: string;
    stitching: string;
    finishing: string;
  }>(draft?.manualWorkers ?? {
    cutting: workers.find((w) => w.role === "cutting")?.id ?? "unassigned",
    stitching: workers.find((w) => w.role === "stitching")?.id ?? "unassigned",
    finishing: workers.find((w) => w.role === "finishing")?.id ?? "unassigned",
  });
  const [discount, setDiscount] = useState(draft?.discount ?? "0");
  const [advance, setAdvance] = useState(draft?.advance ?? "0");
  const [method, setMethod] = useState(draft?.method ?? "cash");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useMutationError();
  const seq = useRef(Math.max(1, ...lines.map((line) => line.key)));
  const draftQueue = useRef<Promise<void>>(Promise.resolve());
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const customerId = customer?.id;

  useEffect(() => {
    if (!customerId) return;
    const controller = new AbortController();
    let alive = true;
    fetch(`/api/v1/customers/${customerId}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        const list: Profile[] = data.profiles ?? [];
        setProfiles(list);
        setProfileId((cur) =>
          list.find((p) => p.id === cur)?.id ?? list.find((p) => p.is_default)?.id ?? list[0]?.id ?? "",
        );
      })
      .catch(() => {
        if (alive) setProfiles([]);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [customerId]);

  // Load initialCustomerId if passed via query string
  useEffect(() => {
    if (!initialCustomerId) return;
    const controller = new AbortController();
    let alive = true;
    fetch(`/api/v1/customers/${initialCustomerId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (alive && data?.id) {
          const hit: CustomerHit = {
            id: data.id,
            name: data.name,
            phone: String(data.phone ?? "").replace(/^\+88/, ""),
            address: null,
            tags: [],
            open_due: 0,
            order_count: 0,
          };
          setCustomer(hit);
          setLines((prev) => (prev.length ? prev : [newLine(garments[0], 1)]));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      controller.abort();
    };
  }, [initialCustomerId, garments]);

  const draftPayload = useMemo<OrderDraft>(() => ({ customer, profileId, lines, delivery: delivery ? iso(delivery) : "", discount, advance, notes, priority, assignmentMode, method, manualWorkers }),
    [customer, profileId, lines, delivery, discount, advance, notes, priority, assignmentMode, method, manualWorkers]);
  const persistDraft = useCallback((payload: OrderDraft) => {
    const next = draftQueue.current.catch(() => {}).then(async () => {
      await requestJson("/api/v1/drafts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft: payload }) });
      toast.success("খসড়া সংরক্ষিত হয়েছে।", { id: "order-draft-save", duration: 1500 });
    });
    draftQueue.current = next;
    return next;
  }, []);
  useEffect(() => {
    if (!draftPayload.customer) return;
    draftTimer.current = setTimeout(() => {
      draftTimer.current = null;
      void persistDraft(draftPayload).catch((error: Error) => toast.error(error.message, { id: "order-draft-save" }));
    }, 800);
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
  }, [draftPayload, persistDraft]);

  async function openMeasurements(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (draftTimer.current) clearTimeout(draftTimer.current);
    try { await persistDraft(draftPayload); router.push(href); }
    catch (error) { setError(error instanceof Error ? error.message : "খসড়া সংরক্ষণ হয়নি।"); }
  }

  // customer search
  useEffect(() => {
    if (customer || query.trim().length < 2) return;
    const controller = new AbortController();
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/customers?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (alive) setHits(data.customers ?? []);
      } catch {
        if (alive) setHits([]);
      }
    }, 220);
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, customer]);

  function makeLine(g: Garment): Line {
    seq.current += 1;
    return newLine(g, seq.current);
  }

  function pickCustomer(c: CustomerHit) {
    setCustomer(c);
    setHits([]);
    setQuery("");
    setError(null);
    setProfiles([]);
    setProfileId("");
    setLines((prev) => (prev.length ? prev : [makeLine(garments[0])]));
  }

  async function createCustomer() {
    setError(null);
    if (newName.trim().length < 2) {
      setError("কাস্টমারের নাম লিখুন");
      return;
    }
    if (!/^[0-9+\-\s]{11,17}$/.test(newPhone.trim())) {
      setError("সঠিক ফোন নম্বর দিন (01XXXXXXXXX)");
      return;
    }
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok && data?.error?.customer_id && data.customer) {
        pickCustomer(data.customer as CustomerHit);
        setNewName("");
        setNewPhone("");
        setError(`এই ফোন নম্বরে ${data.customer.name} ইতিমধ্যে আছেন — তাঁকে বেছে নেওয়া হয়েছে।`);
        return;
      }
      if (!res.ok) {
        setError(data?.error?.message ?? "কাস্টমার তৈরি হয়নি");
        return;
      }
      pickCustomer({
        id: data.id,
        name: data.name,
        phone: data.phone,
        address: data.address ?? null,
        tags: data.tags ?? [],
        open_due: 0,
        order_count: 0,
      });
      setNewName("");
      setNewPhone("");
      toast.success("কাস্টমার সংরক্ষিত হয়েছে।");
    } catch {
      setError("নেটওয়ার্ক সমস্যা");
    }
  }

  const profile = profiles.find((p) => p.id === profileId);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines]);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const setFor = (line: Line) => profile?.sets.find((s) => s.garment_type_id === line.garmentId);
  const missing = lines.filter((l) => !setFor(l)).length;

  function addDaysPreset(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDelivery(d);
  }

  async function submit() {
    setError(null);
    if (!customer) return setError("আগে কাস্টমার বেছে নিন");
    if (lines.length === 0) return setError("অন্তত একটি পোশাক যোগ করুন");
    if (!profileId) return setError("মাপ কার (প্রোফাইল) বেছে নিন");
    if (missing > 0) return setError(`${missing}টি পোশাকের মাপ নেই — “মাপ নিন” বাটনে গিয়ে মাপ নিন`);
    setBusy(true);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    try {
      await draftQueue.current.catch(() => {});
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_id: customer.id,
          priority,
          delivery_date: delivery ? iso(delivery) : "",
          discount: Number(discount) || 0,
          notes: notes || undefined,
          payment: { amount: Number(advance) || 0, method },
          assignment_mode: assignmentMode,
          manual_workers: assignmentMode === "manual" ? manualWorkers : undefined,
          items: lines.map((l) => ({
            garment_type_id: l.garmentId,
            profile_id: profileId,
            measurement_set_id: setFor(l)?.id ?? null,
            quantity: l.qty,
            unit_price: l.price,
            fabric_source: l.fabricSource,
            fabric_qty: l.fabricSource === "shop" ? l.fabricQty : 0,
            design_notes: l.notes || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "অর্ডার তৈরি হয়নি");
      } else {
        toast.success("অর্ডার সংরক্ষিত হয়েছে।");
        await requestJson("/api/v1/drafts", { method: "DELETE" }).catch((error: Error) => toast.error(error.message));
        router.push(`/admin/orders/${data.id}`);
      }
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setBusy(false);
    }
  }

  const measureHref = (line: Line) =>
    `/admin/customers/${customer?.id}/measurements/new?profile=${profileId}&garment=${line.garmentId}&return=/admin/orders/new`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
      <div className="space-y-6">
        {/* ০১ customer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="num text-gold-dark">০১</span> কাস্টমার নির্বাচন
            </CardTitle>
            <CardDescription>
              নাম ও মোবাইল নম্বর দিয়ে খুঁজুন, না পেলে নিচে নতুন কাস্টমার তৈরি করুন।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-gold/60 bg-gold-light/35 p-4">
                <div>
                  <div className="text-[17px] font-medium">{customer.name}</div>
                  <div className="num text-[14px] text-ink-3">{customer.phone}</div>
                </div>
                <span className="text-[14px] text-ink-3">{customer.address ?? ""}</span>
                {customer.order_count > 0 && (
                  <Badge variant="secondary">পুরনো কাস্টমার · {customer.order_count} অর্ডার</Badge>
                )}
                {customer.tags.map((t) => (
                  <Badge key={t} variant="gold">
                    {t}
                  </Badge>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setCustomer(null);
                    setProfiles([]);
                    setLines([]);
                    setError(null);
                  }}
                >
                  কাস্টমার বদলান
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Label htmlFor="cw-q">নাম বা ফোন দিয়ে খুঁজুন</Label>
                  <Input
                    id="cw-q"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setHits([]);
                    }}
                    placeholder="যেমন: ০১৭… বা রহিমউদ্দিন"
                    className="mt-1.5"
                    autoComplete="off"
                  />
                  {hits.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-ink/15 bg-white shadow-xl">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => pickCustomer(h)}
                            className="flex h-auto w-full items-baseline justify-start gap-3 px-3.5 py-2.5 text-left font-normal hover:bg-gold-light/50"
                          >
                            <span className="font-medium">{h.name}</span>
                            <span className="num text-[14px] text-ink-3">{h.phone}</span>
                            {h.open_due > 0 && (
                              <span className="num ml-auto text-[13.5px] text-chalk">
                                বকেয়া ৳{Math.round(h.open_due).toLocaleString("en-US")}
                              </span>
                            )}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-md border border-dashed border-ink/20 bg-paper/60 p-4">
                  <div className="smallcaps mb-2 text-stone">নতুন কাস্টমার তৈরি করুন</div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="কাস্টমারের নাম"
                      aria-label="নতুন কাস্টমারের নাম"
                      className="min-w-[180px] flex-1"
                    />
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="01XXXXXXXXX"
                      aria-label="নতুন কাস্টমারের ফোন"
                      className="num min-w-[170px] flex-1"
                    />
                    <Button type="button" variant="gold" onClick={createCustomer}>
                      তৈরি করুন
                    </Button>
                  </div>
                  <p className="mt-2 text-[13px] text-stone">
                    তৈরি হলে সঙ্গে সঙ্গে “নিজে” নামে মাপ প্রোফাইল তৈরি হবে এবং সেখান থেকেই মাপ নেওয়া যাবে।
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ০২ items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="num text-gold-dark">০২</span> পোশাক ও মাপ
            </CardTitle>
            <CardDescription>
              প্রতিটি পোশাকের মাপ অ্যাসাইন করা থাকতে হবে — মাপ না থাকলে “মাপ নিন” বাটনে ক্লিক করুন।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!customer && (
              <p className="rounded-md bg-paper-2 px-4 py-3 text-[14.5px] text-ink-3">
                আগে কাস্টমার বেছে নিলেই পোশাক যোগ ও মাপ নেওয়া যাবে।
              </p>
            )}

            {customer && (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-[220px] flex-1 sm:max-w-xs">
                    <Label>মাপ কার (প্রোফাইল)</Label>
                    <Select value={profileId} onValueChange={setProfileId}>
                      <SelectTrigger className="mt-1.5" aria-label="মাপ কার">
                        <SelectValue placeholder="প্রোফাইল বাছুন" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.display_name}
                            {p.relation && p.relation !== "self" ? ` (${p.relation})` : ""}
                          </SelectItem>
                        ))}
                        {profiles.length === 0 && (
                          <SelectItem value="none" disabled>
                            কোনো প্রোফাইল নেই
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild type="button" variant="outline">
                      <Link href={`/admin/customers/${customer.id}`}>কাস্টমার প্রোফাইল</Link>
                    </Button>
                    <Button asChild type="button" variant="gold">
                      <Link
                        href={`/admin/customers/${customer.id}/measurements/new?profile=${profileId}&return=/admin/orders/new`}
                        onClick={(event) => void openMeasurements(event, `/admin/customers/${customer.id}/measurements/new?profile=${profileId}&return=/admin/orders/new`)}
                      >
                        + নতুন মাপ নিন
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {lines.map((line) => {
                    const g = garments.find((x) => x.id === line.garmentId)!;
                    const set = setFor(line);
                    return (
                      <div key={line.key} className="rounded-md border border-ink/15 bg-paper/50 p-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="min-w-[180px] flex-1">
                            <Label className="text-[13.5px] text-ink-3">পোশাক</Label>
                            <Select
                              value={line.garmentId}
                              onValueChange={(v) => {
                                const ng = garments.find((x) => x.id === v)!;
                                setLines((ls) =>
                                  ls.map((l) =>
                                    l.key === line.key
                                      ? {
                                          ...l,
                                          garmentId: ng.id,
                                          price: Number(ng.basePrice),
                                          fabricQty: ng.fabricEstimate == null ? "" : String(ng.fabricEstimate),
                                        }
                                      : l,
                                  ),
                                );
                              }}
                            >
                              <SelectTrigger className="mt-1.5" aria-label="পোশাক">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {garments.map((x) => (
                                  <SelectItem key={x.id} value={x.id}>
                                    {x.nameBn}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="w-24">
                            <Label className="text-[13.5px] text-ink-3">পরিমাণ</Label>
                            <Input
                              type="number"
                              min={1}
                              value={line.qty}
                              onChange={(e) =>
                                setLines((ls) =>
                                  ls.map((l) =>
                                    l.key === line.key ? { ...l, qty: Math.max(1, Number(e.target.value) || 1) } : l,
                                  ),
                                )
                              }
                              className="num mt-1.5"
                            />
                          </div>

                          <div className="w-32">
                            <Label className="text-[13.5px] text-ink-3">দাম (৳)</Label>
                            <Input
                              inputMode="decimal"
                              value={line.price}
                              onChange={(e) =>
                                setLines((ls) =>
                                  ls.map((l) =>
                                    l.key === line.key ? { ...l, price: Number(e.target.value) || 0 } : l,
                                  ),
                                )
                              }
                              className="num mt-1.5"
                            />
                          </div>

                          <div className="w-44">
                            <Label className="text-[13.5px] text-ink-3">কাপড়</Label>
                            <Select
                              value={line.fabricSource}
                              onValueChange={(v) =>
                                setLines((ls) =>
                                  ls.map((l) =>
                                    l.key === line.key
                                      ? { ...l, fabricSource: v as "shop" | "customer" }
                                      : l,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger className="mt-1.5" aria-label="কাপড়">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="shop">দোকানের স্টক</SelectItem>
                                <SelectItem value="customer">কাস্টমারের নিজের</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {lines.length > 1 && (
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                            >
                              বাদ
                            </Button>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[13.5px]">
                          {set ? (
                            <>
                              <Badge variant="success">
                                ✓ মাপ v{set.version} · {ageDays(set.measured_at)} দিন আগে
                              </Badge>
                              <Link href={measureHref(line)} onClick={(event) => void openMeasurements(event, measureHref(line))} className="chalk-link font-medium text-gold-dark">
                                মাপ দেখুন / আপডেট করুন →
                              </Link>
                            </>
                          ) : (
                            <>
                              <Badge variant="destructive">এই পোশাকের মাপ নেই</Badge>
                              <Button asChild type="button" variant="gold" size="sm">
                                <Link href={measureHref(line)} onClick={(event) => void openMeasurements(event, measureHref(line))}>এখনই মাপ নিন →</Link>
                              </Button>
                            </>
                          )}

                          {line.fabricSource === "shop" && (
                            <span className="ml-auto flex items-center gap-2 text-ink-3">
                              <Label htmlFor={`fq-${line.key}`} className="text-[13px] text-ink-3">
                                কাপড় (গজ):
                              </Label>
                              <Input
                                id={`fq-${line.key}`}
                                value={line.fabricQty}
                                onChange={(e) =>
                                  setLines((ls) =>
                                    ls.map((l) => (l.key === line.key ? { ...l, fabricQty: e.target.value } : l)),
                                  )
                                }
                                className="num h-8.5 w-20 px-2.5 text-[14px]"
                              />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLines((ls) => [...ls, makeLine(garments[0])])}
                    className="border-dashed"
                  >
                    + আরেকটি পোশাক যোগ করুন
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ০৩ Worker Assignment Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="num text-gold-dark">০৩</span> কারিগর কাজ বণ্টন কৌশল
            </CardTitle>
            <CardDescription>
              চাইলে একটার পর একটা স্বয়ংক্রিয়ভাবে কারিগরকে দায়িত্ব দিতে পারেন, নিজে বেছে দিতে পারেন, অথবা এখন বণ্টন না করে পরে ড্যাশবোর্ড থেকে দিতে পারেন।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  mode: "auto" as const,
                  title: "স্বয়ংক্রিয় বণ্টন",
                  sub: "একটার পর একটা (কাজের চাপ অনুযায়ী)",
                  icon: Sparkles,
                },
                {
                  mode: "manual" as const,
                  title: "নিজে বেছে দিন",
                  sub: "পছন্দের কারিগরকে এখনই দিন",
                  icon: UserCheck,
                },
                {
                  mode: "unassigned" as const,
                  title: "এখন বণ্টন করব না",
                  sub: "পরে ড্যাশবোর্ড থেকে বণ্টন",
                  icon: Clock,
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = assignmentMode === opt.mode;
                return (
                  <Button
                    key={opt.mode}
                    type="button"
                    variant="outline"
                    onClick={() => setAssignmentMode(opt.mode)}
                    aria-pressed={active}
                    className={`flex h-auto flex-col items-start gap-1 rounded-md p-3.5 text-left font-normal whitespace-normal transition-all ${
                      active
                        ? "border-gold bg-gold-light/40 ring-2 ring-gold/30 hover:bg-gold-light/40"
                        : "border-ink/15 bg-white hover:bg-paper-2/50"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-medium text-ink">{opt.title}</span>
                      <Icon className={`size-4 ${active ? "text-gold-dark" : "text-stone"}`} />
                    </div>
                    <span className="text-[12.5px] text-ink-3">{opt.sub}</span>
                  </Button>
                );
              })}
            </div>

            {assignmentMode === "manual" && (
              <div className="grid gap-3 rounded-md border border-ink/15 bg-paper/60 p-4 sm:grid-cols-3">
                {(
                  [
                    ["cutting", "কাটিং কারিগর"],
                    ["stitching", "সেলাই কারিগর"],
                    ["finishing", "ফিনিশিং কারিগর"],
                  ] as const
                ).map(([stage, label]) => {
                  const stageWorkers = workers.filter((w) => w.role === stage);
                  return (
                    <div key={stage} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Select
                        value={manualWorkers[stage]}
                        onValueChange={(v) =>
                          setManualWorkers((prev) => ({ ...prev, [stage]: v }))
                        }
                      >
                        <SelectTrigger aria-label={label}>
                          <SelectValue placeholder="কারিগর বাছুন" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">— পরে দেব —</SelectItem>
                          {stageWorkers.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name} ({w.activeLoad}টি কাজ)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right column: Date, Pricing & Payment */}
      <div className="space-y-6">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="num text-gold-dark">০৪</span> তারিখ, মূল্য ও পেমেন্ট
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Popover Calendar Date Picker — never sits open automatically */}
            <div className="space-y-1.5">
              <Label>ডেলিভারি তারিখ</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between font-normal text-ink"
                  >
                    <span className="num">
                      {delivery
                        ? `${dateShort(delivery)} (${relativeDay(iso(delivery))})`
                        : "তারিখ নির্বাচন করুন"}
                    </span>
                    <CalendarIcon className="size-4 text-stone" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={delivery}
                    onSelect={(d) => {
                      if (d) setDelivery(d);
                      setCalendarOpen(false);
                    }}
                    disabled={{ before: new Date() }}
                  />
                </PopoverContent>
              </Popover>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  [4, "+৪ দিন"],
                  [7, "+৭ দিন"],
                  [10, "+১০ দিন"],
                  [14, "+১৪ দিন"],
                ].map(([days, label]) => (
                  <Button
                    key={days}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => addDaysPreset(Number(days))}
                    className="h-7 px-2.5 text-[12.5px]"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>অগ্রাধিকার</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={priority === "normal" ? "default" : "outline"}
                  onClick={() => setPriority("normal")}
                >
                  সাধারণ
                </Button>
                <Button
                  type="button"
                  variant={priority === "urgent" ? "destructive" : "outline"}
                  onClick={() => setPriority("urgent")}
                >
                  জরুরি
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cw-discount">ছাড় (৳)</Label>
                <Input
                  id="cw-discount"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="num"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cw-advance">অ্যাডভান্স (৳)</Label>
                <Input
                  id="cw-advance"
                  inputMode="decimal"
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value)}
                  className="num"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>পেমেন্ট মাধ্যম</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger aria-label="পেমেন্ট মাধ্যম">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">ক্যাশ</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="rocket">Rocket</SelectItem>
                  <SelectItem value="bank">ব্যাংক/কার্ড</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cw-notes">বিশেষ নির্দেশনা / নোট</Label>
              <Textarea
                id="cw-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="যেমন: কাস্টমার নিজের কাপড় আনবেন"
              />
            </div>

            <Separator />

            <dl className="space-y-1.5 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-ink-3">উপমোট</dt>
                <dd className="num">৳ {subtotal.toLocaleString("en-US")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-3">ছাড়</dt>
                <dd className="num">− ৳ {(Number(discount) || 0).toLocaleString("en-US")}</dd>
              </div>
              <div className="flex justify-between border-t border-ink/15 pt-1.5 text-[18px] font-semibold">
                <dt>সর্বমোট</dt>
                <dd className="num">৳ {total.toLocaleString("en-US")}</dd>
              </div>
              <div className="flex justify-between text-[14.5px]">
                <dt className="text-ink-3">বকেয়া থাকবে</dt>
                <dd className={`num ${total - (Number(advance) || 0) > 0 ? "font-medium text-chalk" : "text-[#1D6B3F]"}`}>
                  ৳ {Math.max(0, total - (Number(advance) || 0)).toLocaleString("en-US")}
                </dd>
              </div>
            </dl>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>অর্ডার তৈরি হয়নি</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={submit}
              disabled={busy || !customer}
            >
              {busy ? "তৈরি হচ্ছে…" : "অর্ডার নিশ্চিত করুন"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
