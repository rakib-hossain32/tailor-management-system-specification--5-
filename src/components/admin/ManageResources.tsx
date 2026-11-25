"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Archive, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateField } from "@/components/DateField";

type Row = Record<string, unknown> & { id?: string };
type Field = { key: string; label: string; type?: string; required?: boolean; options?: string[]; createOnly?: boolean; editOnly?: boolean };
type Spec = { label: string; fields: Field[]; columns: [string, string][] };
const identity: Field[] = [{ key: "personId", label: "বিদ্যমান ব্যক্তি (ঐচ্ছিক)", type: "person" }, { key: "name", label: "নাম", required: true }, { key: "phone", label: "ফোন নম্বর", type: "tel" }, { key: "email", label: "ইমেইল", type: "email" }];
const active: Field = { key: "isActive", label: "সক্রিয়", type: "checkbox" };
const methods = ["cash", "bkash", "nagad", "rocket", "card", "bank"];
const specs: Record<string, Spec> = {
  users: { label: "ব্যবহারকারী", fields: [...identity, { key: "role", label: "ভূমিকা", options: ["owner", "manager", "reception", "master", "worker"], required: true }, { key: "password", label: "পাসওয়ার্ড (কমপক্ষে ১০ অক্ষর)", type: "password" }, active], columns: [["name", "নাম"], ["phone", "ফোন"], ["email", "ইমেইল"], ["role", "ভূমিকা"]] },
  workers: { label: "কারিগর", fields: [...identity, { key: "role", label: "কাজের ধাপ", options: ["cutting", "stitching", "finishing"], required: true }, { key: "skillTags", label: "দক্ষতা (কমা দিয়ে)" }, { key: "payType", label: "মজুরির ধরন", options: ["piece_rate", "salary"] }, { key: "monthlySalary", label: "মাসিক বেতন", type: "number" }, { key: "joinedOn", label: "যোগদানের তারিখ", type: "date" }, { key: "password", label: "লগইন চালু করতে পাসওয়ার্ড (ঐচ্ছিক)", type: "password", createOnly: true }, active], columns: [["name", "নাম"], ["phone", "ফোন"], ["role", "ধাপ"], ["payType", "মজুরির ধরন"]] },
  garments: { label: "পোশাক ও মাপ", fields: [{ key: "code", label: "কোড", required: true }, { key: "nameBn", label: "নাম (বাংলা)", required: true }, { key: "nameEn", label: "নাম (ইংরেজি)", required: true }, { key: "category", label: "ক্যাটাগরি", options: ["gents", "ladies", "kids", "unisex"] }, { key: "basePrice", label: "মূল্য", type: "number", required: true }, { key: "defaultDeliveryDays", label: "ডেলিভারির দিন", type: "number", required: true }, { key: "defaultFabricEstimate", label: "প্রয়োজনীয় কাপড়", type: "number" }, { key: "sortOrder", label: "তালিকায় ক্রম", type: "number" }, { key: "rate_cutting", label: "কাটিং মজুরি", type: "number", required: true }, { key: "rate_stitching", label: "সেলাই মজুরি", type: "number", required: true }, { key: "rate_finishing", label: "ফিনিশিং মজুরি", type: "number", required: true }, active], columns: [["nameBn", "পোশাক"], ["code", "কোড"], ["basePrice", "মূল্য"], ["schemaVersion", "মাপের সংস্করণ"]] },
  fabrics: { label: "কাপড়", fields: [{ key: "code", label: "কোড", required: true }, { key: "name", label: "কাপড়ের নাম", required: true }, { key: "type", label: "ধরন", required: true }, { key: "color", label: "রং" }, { key: "unit", label: "একক", options: ["yard", "meter"] }, { key: "costPrice", label: "ক্রয়মূল্য", type: "number" }, { key: "sellPrice", label: "বিক্রয়মূল্য", type: "number" }, { key: "reorderLevel", label: "রিঅর্ডার সীমা", type: "number" }, { key: "supplier", label: "সরবরাহকারী" }, { key: "openingStock", label: "প্রারম্ভিক স্টক", type: "number", createOnly: true }, { key: "qtyDelta", label: "স্টক যোগ বা বিয়োগ", type: "number", editOnly: true }, { key: "reason", label: "স্টক পরিবর্তনের কারণ" }, active], columns: [["name", "কাপড়"], ["code", "কোড"], ["stockQty", "স্টক"], ["unit", "একক"]] },
  expenses: { label: "খরচ", fields: [{ key: "category", label: "ক্যাটাগরি", required: true }, { key: "amount", label: "পরিমাণ", type: "number", required: true }, { key: "date", label: "তারিখ", type: "date", required: true }, { key: "method", label: "মাধ্যম", options: methods }, { key: "note", label: "নোট", type: "textarea" }, active], columns: [["category", "ক্যাটাগরি"], ["date", "তারিখ"], ["amount", "পরিমাণ"], ["method", "মাধ্যম"]] },
  appointments: { label: "অ্যাপয়েন্টমেন্ট", fields: [identity[0], identity[1], identity[2], { key: "purpose", label: "উদ্দেশ্য", required: true }, { key: "garments", label: "কী বানাতে চান (কমা দিয়ে একাধিক)" }, { key: "date", label: "তারিখ", type: "date", required: true }, { key: "slot", label: "সময়", type: "time", required: true }, { key: "status", label: "অবস্থা", options: ["booked", "confirmed", "done", "no_show", "cancelled"] }, { key: "locationType", label: "মাপ নেওয়ার স্থান", options: ["shop", "home"] }, { key: "address", label: "ঠিকানা" }, { key: "notes", label: "নোট", type: "textarea" }], columns: [["name", "নাম"], ["date", "তারিখ"], ["slot", "সময়"], ["garments", "বানাতে চান"], ["status", "অবস্থা"]] },
};
const labels: Record<string, string> = { owner: "মালিক", manager: "ম্যানেজার", reception: "রিসেপশন", master: "মাস্টার", worker: "কারিগর", cutting: "কাটিং", stitching: "সেলাই", finishing: "ফিনিশিং", piece_rate: "পিস-রেট", salary: "মাসিক বেতন", gents: "পুরুষ", ladies: "নারী", kids: "শিশু", unisex: "সবার", yard: "গজ", meter: "মিটার", cash: "ক্যাশ", bank: "ব্যাংক", card: "কার্ড", booked: "বুক করা", confirmed: "নিশ্চিত", done: "সম্পন্ন", no_show: "আসেননি", cancelled: "বাতিল", shop: "দোকান", home: "বাড়ি" };
type StyleField = { key: string; label_bn: string; type: string; choices?: { value: string; label_bn: string }[] };
type MeasureField = { key: string; label_bn: string; label_en: string; type: string; required: boolean; min?: number; max?: number; order?: number };
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  const raw = String(value);
  return labels[raw] ?? raw;
}
function measurements(row: Row): MeasureField[] {
  const schema = row.measurementSchema as { groups?: { fields?: MeasureField[] }[] } | undefined;
  return schema?.groups?.flatMap((group) => group.fields ?? []).map((field) => ({ ...field })) ?? [];
}
function initialValues(row: Row | undefined, resource: string, today: string) {
  const result: Record<string, string | boolean> = {};
  for (const field of specs[resource].fields) {
    const current = row?.[field.key];
    result[field.key] = field.type === "checkbox" ? current !== false : current == null ? "" : Array.isArray(current) ? current.join(", ") : String(current);
    if (!row && field.options) result[field.key] = field.options[0];
  }
  if (!row && ["expenses", "appointments"].includes(resource)) result.date = today;
  if (!row && resource === "users") result.role = "reception";
  if (!row && resource === "workers") result.role = "stitching";
  if (resource === "garments") {
    const rates = row?.stageRates as Record<string, unknown> | undefined;
    for (const stage of ["cutting", "stitching", "finishing"]) result["rate_" + stage] = rates?.[stage] == null ? "" : String(rates[stage]);
  }
  result.password = "";
  return result;
}

export function ManageResources({ resource, available, initialRows, total, page, limit, query, people, today, isOwner }: {
  resource: string; available: string[]; initialRows: Row[]; total: number; page: number; limit: number; query: string;
  people: { id: string; name: string; phone: string | null }[]; today: string; isOwner: boolean;
}) {
  const spec = specs[resource];
  const [rows, setRows] = useState(initialRows);
  const [totalState, setTotalState] = useState(total);
  const [pageState, setPageState] = useState(page);
  const [search, setSearch] = useState(query);
  const searchFirst = useRef(true);
  const [editor, setEditor] = useState<Row | null | undefined>(undefined);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [fields, setFields] = useState<MeasureField[]>([]);
  const [schemaChanged, setSchemaChanged] = useState(false);
  const [styleFields, setStyleFields] = useState<StyleField[]>([]);
  const [stylesChanged, setStylesChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editId = editor?.id;
  function open(row?: Row) { setEditor(row ?? null); setValues(initialValues(row, resource, today)); setFields(row ? measurements(row) : []); setSchemaChanged(false); setStyleFields((row?.styleSchema as { options?: StyleField[] } | undefined)?.options ?? []); setStylesChanged(false); setError(""); }
  const api = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const response = await fetch(path, { method, headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? "অনুরোধ সম্পন্ন করা যায়নি");
    return data;
  }, []);
  const load = useCallback(
    async (nextPage: number, nextQuery: string) => {
      try {
        const data = await api("/api/v1/admin/" + resource + "?" + new URLSearchParams({ page: String(nextPage), limit: String(limit), q: nextQuery }));
        setRows(data.data);
        setTotalState(data.meta?.total ?? data.data.length);
        setPageState(nextPage);
      } catch { toast.error("তালিকা হালনাগাদ করা যায়নি — পাতাটি আবার খুলুন"); }
    },
    [resource, limit, api],
  );
  async function reload() {
    await load(pageState, search);
  }
  // Instant search: typing re-queries the list (debounced) — there is
  // no খুঁজুন button anywhere on this page anymore.
  useEffect(() => {
    if (searchFirst.current) {
      searchFirst.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void load(1, search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, load]);
  async function edit(row: Row) {
    setBusy(true);
    try { const result = await api("/api/v1/admin/" + resource + "/" + row.id); open(result.data); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "তথ্য খোলা যায়নি"); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const payload: Record<string, unknown> = {};
      for (const field of spec.fields) {
        if ((field.createOnly && editId) || (field.editOnly && !editId)) continue;
        if (resource === "workers" && field.key === "password" && !isOwner) continue;
        const value = values[field.key];
        if (field.type === "checkbox") payload[field.key] = value === true;
        else if (field.type === "number") { if (value !== "") payload[field.key] = Number(value); }
        else if (field.key === "skillTags") payload[field.key] = String(value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
        else if (value !== "") payload[field.key] = value;
        else if (editId && !["password", "personId"].includes(field.key)) payload[field.key] = field.required ? "" : null;
      }
      if (resource === "garments") {
        payload.stageRates = Object.fromEntries(["cutting", "stitching", "finishing"].map((stage) => [stage, Number(values["rate_" + stage])]));
        for (const stage of ["cutting", "stitching", "finishing"]) delete payload["rate_" + stage];
        if (!editId || schemaChanged) {
          const old = editor?.measurementSchema as { validation_rules?: unknown[] } | undefined;
          payload.measurementSchema = { version: 1, unit: "cm", groups: [{ key: "measurements", label_bn: "মাপ", label_en: "Measurements", fields: fields.map((field, index) => ({ ...field, order: index + 1 })) }], validation_rules: old?.validation_rules ?? [] };

        }
        if (!editId || stylesChanged) payload.styleSchema = { options: styleFields };
      }
      await api("/api/v1/admin/" + resource + (editId ? "/" + editId : ""), editId ? "PATCH" : "POST", payload);
      toast.success(editId ? "পরিবর্তন সংরক্ষিত হয়েছে" : "নতুন তথ্য সংরক্ষিত হয়েছে");
      setEditor(undefined); await reload();
    } catch (cause) { const message = cause instanceof Error ? cause.message : "সংরক্ষণ করা যায়নি"; setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  async function archive(row: Row) {
    if (busy) return;
    setBusy(true);
    try { await api("/api/v1/admin/" + resource + "/" + row.id, "DELETE"); toast.success(resource === "appointments" ? "অ্যাপয়েন্টমেন্ট বাতিল হয়েছে" : "তথ্য নিষ্ক্রিয় করা হয়েছে"); await reload(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "পরিবর্তন করা যায়নি"); }
    finally { setBusy(false); }
  }
  function updateField(index: number, change: Partial<MeasureField>) { setSchemaChanged(true); setFields((current) => current.map((field, i) => i === index ? { ...field, ...change } : field)); }
  return (
    <div className="space-y-5">
      <header><div className="smallcaps text-stone">ব্যবস্থাপনা</div><h1 className="mt-1 text-[32px]">তথ্য যোগ ও সম্পাদনা</h1><p className="text-ink-3">সক্রিয় অবস্থা বদলালে পুরনো অর্ডার ও হিসাব সংরক্ষিত থাকে।</p>{resource === "garments" && <p className="mt-1 text-ink-3">এখানে যোগ করা ও <b>সক্রিয়</b> রাখা পোশাকগুলোই অ্যাপয়েন্টমেন্ট পেজের “কী বানাতে চান” তালিকায় দেখাবে — কাস্টমার সেখান থেকে এক বা একাধিক বেছে নিতে পারবে।</p>}</header>
      <nav className="flex flex-wrap gap-2" aria-label="তথ্যের ধরন">{available.map((item) => <Link key={item} href={"/admin/manage?resource=" + item} className={"rounded-full border px-4 py-2 text-sm " + (item === resource ? "bg-ink text-paper" : "border-ink/20 hover:bg-gold-light")}>{specs[item].label}</Link>)}</nav>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><CardTitle>{spec.label} <span className="num text-sm text-stone">({totalState})</span></CardTitle><Button onClick={() => open()} disabled={busy}><Plus className="size-4" /> নতুন যোগ করুন</Button></CardHeader>
        <CardContent>
          <div className="mb-4"><Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="অনুসন্ধান" placeholder="লিখলেই খুঁজবে — নাম (বাংলা/ইংরেজি), কোড, ফোন, মূল্য, সক্রিয় বা নিষ্ক্রিয়" autoComplete="off" /></div>
          <div className="overflow-x-auto"><Table className="w-full text-left text-sm"><TableHeader><TableRow className="border-b border-ink/20">{spec.columns.map(([key, label]) => <TableHead key={key} className="px-3 py-3">{label}</TableHead>)}<TableHead className="px-3 py-3">অবস্থা</TableHead><TableHead className="px-3 py-3">পরিবর্তন</TableHead></TableRow></TableHeader><TableBody>
            {rows.map((row) => <TableRow key={row.id} className="border-b border-ink/10">{spec.columns.map(([key]) => <TableCell key={key} className="px-3 py-3">{display(row[key])}</TableCell>)}<TableCell className="px-3 py-3">{resource === "appointments" ? display(row.status) : row.isActive === false ? "নিষ্ক্রিয়" : "সক্রিয়"}</TableCell><TableCell className="px-3 py-3"><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void edit(row)} disabled={busy}><Pencil className="size-3.5" /> সম্পাদনা</Button><Button variant="ghost" size="sm" onClick={() => void archive(row)} disabled={busy || row.isActive === false || row.status === "cancelled" || row.status === "done"}><Archive className="size-3.5" />{resource === "appointments" ? "বাতিল" : "নিষ্ক্রিয়"}</Button></div></TableCell></TableRow>)}
            {!rows.length && <TableRow><TableCell colSpan={spec.columns.length + 2} className="py-10 text-center text-stone">কোনো তথ্য নেই। নতুন তথ্য যোগ করুন।</TableCell></TableRow>}
          </TableBody></Table></div>
          <div className="mt-4 flex items-center justify-between text-sm"><span>পৃষ্ঠা <span className="num">{pageState}</span></span><div className="flex gap-3">{pageState > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => void load(pageState - 1, search)}>আগের পৃষ্ঠা</Button>}{pageState * limit < totalState && <Button type="button" variant="ghost" size="sm" onClick={() => void load(pageState + 1, search)}>পরের পৃষ্ঠা</Button>}</div></div>
        </CardContent>
      </Card>
      <Dialog open={editor !== undefined} onOpenChange={(next) => { if (!next && !busy) setEditor(undefined); }}>
        <DialogContent className="max-h-[92vh] w-[94vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? spec.label + " — সম্পাদনা" : "নতুন " + spec.label}</DialogTitle>
            <DialogDescription>সব তথ্য দিয়ে সংরক্ষণ করুন — সক্রিয় অবস্থা বদলালে পুরনো অর্ডার ও হিসাব সংরক্ষিত থাকে।</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 md:grid-cols-2">
          {spec.fields.filter((field) => (!field.createOnly || !editId) && (!field.editOnly || Boolean(editId)) && !(resource === "workers" && field.key === "password" && !isOwner)).map((field) => {
            const id = resource + "-" + field.key;
            const isIdentity = ["name", "phone", "email"].includes(field.key);
            const disabled = busy || (field.key === "personId" && Boolean(editId)) || (isIdentity && !editId && Boolean(values.personId));
            return <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
              <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
              {field.type === "checkbox" ? <Checkbox id={id} className="ml-3" checked={values[field.key] === true} onCheckedChange={(checked) => setValues({ ...values, [field.key]: checked === true })} disabled={busy} /> :
              field.type === "person" || field.options ? <Select value={String(values[field.key] ?? "") === "" ? "__empty__" : String(values[field.key])} onValueChange={(value) => setValues({ ...values, [field.key]: value === "__empty__" ? "" : value })} disabled={disabled} required={field.required}>
                <SelectTrigger id={id} className="mt-1 w-full"><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  {field.type === "person" ? <><SelectItem value="__empty__">নতুন ব্যক্তি</SelectItem>{people.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}{person.phone ? " · " + person.phone : ""}</SelectItem>)}</> : field.options?.map((option) => <SelectItem key={option} value={option}>{labels[option] ?? option}</SelectItem>)}
                </SelectContent>
              </Select> :
              field.type === "textarea" ? <Textarea id={id} value={String(values[field.key] ?? "")} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} disabled={disabled} /> :
              field.type === "date" ? <DateField key={(editId ?? "new") + "-" + field.key} name={field.key} defaultValue={String(values[field.key] ?? "") || undefined} onChange={(iso) => setValues({ ...values, [field.key]: iso })} /> :
              <Input id={id} type={field.type ?? "text"} value={String(values[field.key] ?? "")} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} required={field.required || (resource === "users" && field.key === "password" && !editId)} minLength={field.type === "password" ? 10 : undefined} step={field.type === "number" ? "0.01" : field.type === "time" ? 300 : undefined} disabled={disabled} autoComplete={field.type === "password" ? "new-password" : "off"} />}
            </div>;
          })}
        </div>
        {resource === "garments" && <fieldset className="space-y-3 rounded-md border border-ink/15 p-4"><legend className="px-2 font-medium">মাপের ফিল্ড</legend><p className="text-sm text-stone">পরিবর্তিত মাপের ফর্ম নতুন সংস্করণে সংরক্ষিত হবে। আগের মাপ ও অর্ডার সংরক্ষিত থাকে।</p>
          {fields.map((field, index) => <div key={field.key} className="grid gap-2 rounded-md bg-paper-2/60 p-3 sm:grid-cols-5"><Input aria-label="ফিল্ডের বাংলা নাম" value={field.label_bn} placeholder="বাংলা নাম" onChange={(event) => updateField(index, { label_bn: event.target.value })} required /><Input aria-label="ফিল্ডের ইংরেজি নাম" value={field.label_en} placeholder="ইংরেজি নাম" onChange={(event) => updateField(index, { label_en: event.target.value })} /><Input aria-label="সর্বনিম্ন সেমি" type="number" value={field.min ?? ""} placeholder="সর্বনিম্ন সেমি" onChange={(event) => updateField(index, { min: event.target.value === "" ? undefined : Number(event.target.value) })} /><Input aria-label="সর্বোচ্চ সেমি" type="number" value={field.max ?? ""} placeholder="সর্বোচ্চ সেমি" onChange={(event) => updateField(index, { max: event.target.value === "" ? undefined : Number(event.target.value) })} /><div className="flex items-center gap-2"><Label htmlFor={`req-${index}`} className="flex cursor-pointer items-center gap-1 text-sm"><Checkbox id={`req-${index}`} checked={field.required} onCheckedChange={(checked) => updateField(index, { required: checked === true })} /> আবশ্যিক</Label><Button type="button" variant="ghost" size="sm" aria-label="ফিল্ড মুছুন" onClick={() => { setSchemaChanged(true); setFields(fields.filter((_, i) => i !== index)); }}><X className="size-3.5" /></Button></div></div>)}
          <Button type="button" variant="outline" onClick={() => { setSchemaChanged(true); setFields([...fields, { key: "field_" + crypto.randomUUID().replaceAll("-", ""), label_bn: "", label_en: "", type: "measurement", required: true }]); }}><Plus className="size-4" /> মাপের ফিল্ড যোগ করুন</Button>
        </fieldset>}
        {resource === "garments" && <fieldset className="space-y-3 rounded-md border border-ink/15 p-4"><legend className="px-2 font-medium">স্টাইলের অপশন</legend>
          {styleFields.map((option, index) => <div key={option.key} className="space-y-2 rounded-md bg-paper-2/60 p-3"><div className="flex gap-2"><Input aria-label="স্টাইলের নাম" value={option.label_bn} placeholder="স্টাইলের নাম" required onChange={(event) => { setStylesChanged(true); setStyleFields(styleFields.map((field, i) => i === index ? { ...field, label_bn: event.target.value } : field)); }} /><Select value={option.type} onValueChange={(value) => { setStylesChanged(true); setStyleFields(styleFields.map((field, i) => i === index ? { ...field, type: value } : field)); }}><SelectTrigger aria-label="স্টাইলের ধরন" className="w-44"><SelectValue /></SelectTrigger><SelectContent>{["select", "multiselect", "boolean", "text"].map((type) => <SelectItem key={type} value={type}>{({ select: "একটি নির্বাচন", multiselect: "একাধিক নির্বাচন", boolean: "হ্যাঁ বা না", text: "লিখিত" } as Record<string, string>)[type]}</SelectItem>)}</SelectContent></Select><Button type="button" variant="ghost" size="sm" aria-label="স্টাইল মুছুন" onClick={() => { setStylesChanged(true); setStyleFields(styleFields.filter((_, i) => i !== index)); }}><X className="size-4" /></Button></div>
          {["select", "multiselect"].includes(option.type) && <Textarea aria-label="স্টাইলের তালিকা" placeholder="প্রতিটি অপশন আলাদা লাইনে লিখুন" value={option.choices?.map((item) => item.label_bn).join("\n") ?? ""} onChange={(event) => { setStylesChanged(true); const choices = event.target.value.split("\n").map((label, i) => ({ value: option.choices?.find((item) => item.label_bn === label)?.value ?? option.choices?.[i]?.value ?? "option_" + crypto.randomUUID().replaceAll("-", ""), label_bn: label })); setStyleFields(styleFields.map((field, i) => i === index ? { ...field, choices } : field)); }} />}
          </div>)}
          <Button type="button" variant="outline" onClick={() => { setStylesChanged(true); setStyleFields([...styleFields, { key: "style_" + crypto.randomUUID().replaceAll("-", ""), label_bn: "", type: "text" }]); }}><Plus className="size-4" /> স্টাইল যোগ করুন</Button>
        </fieldset>}
        {resource === "fabrics" && Array.isArray(editor?.movements) && <div className="space-y-2 rounded-md border border-ink/15 p-4"><h3 className="font-medium">স্টক পরিবর্তনের লেজার</h3>{(editor.movements as Row[]).map((movement) => <div key={String(movement.id)} className="flex flex-wrap justify-between gap-2 border-b border-ink/10 py-2 text-sm"><span>{display(movement.reason)} · {display(movement.actorName)}</span><span className="num">{display(movement.qtyDelta)}</span></div>)}{!editor.movements.length && <p className="text-sm text-stone">কোনো স্টক পরিবর্তন নেই।</p>}</div>}
        {error && <p role="alert" className="text-chalk">{error}</p>}
        <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} সংরক্ষণ করুন</Button><Button type="button" variant="outline" onClick={() => setEditor(undefined)} disabled={busy}>বন্ধ করুন</Button></div>
        </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
