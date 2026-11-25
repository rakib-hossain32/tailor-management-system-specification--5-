"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import type { getAdminSiteContent } from "@/server/cms/admin";
import { requestJson } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type ContentState = Awaited<ReturnType<typeof getAdminSiteContent>>;
type Kind = "shop" | "hours" | "pages" | "sections" | "services" | "gallery" | "media";
type Field = { name: string; label: string; type?: "text" | "email" | "number" | "textarea" | "boolean" | "media" | "select" | "lines"; required?: boolean; nullable?: boolean; options?: { value: string; label: string }[] };
const PAGES = ["home", "about", "services", "gallery", "contact", "how-it-works", "terms", "privacy"];
const KINDS: [Kind, string][] = [["shop", "দোকান"], ["hours", "কর্মঘণ্টা"], ["pages", "পাতা"], ["sections", "পাতার অংশ"], ["services", "সার্ভিস"], ["gallery", "গ্যালারি"], ["media", "ছবি"]];
const DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const option = (value: string, label = value) => ({ value, label });

function fieldsFor(kind: Kind, state: ContentState): Field[] {
  const media: Field = { name: "mediaAssetId", label: "ছবি", type: "media", nullable: true };
  if (kind === "shop") return [
    { name: "nameBn", label: "দোকানের নাম (বাংলা)", required: true }, { name: "nameEn", label: "নাম (ইংরেজি)", required: true },
    { name: "tagline", label: "পরিচিতি", type: "textarea" }, { name: "address", label: "ঠিকানা", type: "textarea" },
    { name: "phone", label: "ফোন" }, { name: "email", label: "ইমেইল", type: "email" }, { name: "whatsapp", label: "WhatsApp নম্বর" },
    { name: "facebookUrl", label: "ফেসবুক লিংক" }, { name: "foundedYear", label: "প্রতিষ্ঠার বছর", type: "number", nullable: true },
    { name: "invoiceFooter", label: "ইনভয়েসের নিচের লেখা", type: "textarea" },
    { name: "logoAssetId", label: "লোগো", type: "media", nullable: true }, { name: "heroAssetId", label: "হোম পাতার ছবি", type: "media", nullable: true }, { name: "aboutAssetId", label: "পরিচিতি পাতার ছবি", type: "media", nullable: true },
  ];
  if (kind === "pages") return [{ name: "slug", label: "পাতা", type: "select", required: true, options: PAGES.map((value) => option(value)) }, { name: "title", label: "শিরোনাম", required: true }, { name: "intro", label: "ভূমিকা", type: "textarea" }, { name: "seoTitle", label: "সার্চ শিরোনাম" }, { name: "seoDescription", label: "সার্চ বিবরণ", type: "textarea" }, { name: "published", label: "প্রকাশিত", type: "boolean" }];
  if (kind === "sections") return [{ name: "pageSlug", label: "পাতা", type: "select", required: true, options: state.pages.map((page) => option(page.slug, page.title)) }, { name: "kind", label: "অংশের ধরন", type: "select", required: true, options: ["hero", "benefit", "process", "paragraph", "testimonial", "team", "milestone", "faq", "policy", "service", "statistic", "tracking", "cta", "showroom"].map((value) => option(value)) }, { name: "heading", label: "শিরোনাম" }, { name: "body", label: "মূল লেখা", type: "textarea" }, { name: "subtitle", label: "সহশিরোনাম" }, { name: "label", label: "ছোট লেবেল" }, { name: "position", label: "ক্রম", type: "number", required: true }, { name: "data", label: "অতিরিক্ত তথ্য (JSON)", type: "textarea" }, media, { name: "personId", label: "সংশ্লিষ্ট ব্যক্তি", type: "select", nullable: true, options: state.people.map((person) => option(person.id, person.name)) }, { name: "published", label: "প্রকাশিত", type: "boolean" }];
  if (kind === "services") return [{ name: "garmentTypeId", label: "পোশাক", type: "select", required: true, options: state.garments.map((garment) => option(garment.id, garment.nameBn)) }, { name: "summary", label: "বিবরণ", type: "textarea" }, { name: "features", label: "বৈশিষ্ট্য (প্রতি লাইনে একটি)", type: "lines" }, media, { name: "featured", label: "হোম পাতায় দেখান", type: "boolean" }];
  if (kind === "gallery") return [{ ...media, required: true, nullable: false }, { name: "title", label: "শিরোনাম", required: true }, { name: "caption", label: "বিবরণ", type: "textarea" }, { name: "category", label: "বিভাগ" }, { name: "position", label: "ক্রম", type: "number", required: true }, { name: "published", label: "প্রকাশিত", type: "boolean" }];
  return [];
}

function ContentForm({ kind, record = {}, state, saved }: { kind: Kind; record?: Record<string, unknown>; state: ContentState; saved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const fields = fieldsFor(kind, state);
  const existingId = kind === "pages" ? String(record.slug || "") : String(record.id || "");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const values = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      const value = String(values.get(field.name) ?? "");
      if (kind === "sections" && field.name === "data") {
        try { body.data = JSON.parse(value || "{}"); }
        catch { toast.error("অতিরিক্ত তথ্যের JSON সঠিক নয়।"); setBusy(false); return; }
      } else {
        body[field.name] = field.type === "boolean" ? values.has(field.name) : field.type === "number" ? value === "" && field.nullable ? null : Number(value) : field.type === "lines" ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : value === "" && field.nullable ? null : value;
      }
    }
    try {
      const update = !!existingId && ["sections", "gallery"].includes(kind);
      await requestJson(`/api/v1/admin/content/${kind}${update ? `/${encodeURIComponent(existingId)}` : ""}`, { method: update ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      toast.success("তথ্য সংরক্ষিত হয়েছে।"); await saved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "তথ্য সংরক্ষণ হয়নি।"); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm("এই তথ্যটি সরাবেন?")) return;
    setBusy(true);
    try { await requestJson(`/api/v1/admin/content/${kind}/${encodeURIComponent(existingId)}`, { method: "DELETE" }); toast.success("তথ্য সরানো হয়েছে।"); await saved(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "তথ্য সরানো যায়নি।"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="paper-card space-y-5 p-5 sm:p-7"><div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => {
    const value = kind === "sections" && field.name === "data" ? JSON.stringify(record.data ?? {}, null, 2) : record[field.name];
    if (field.type === "boolean") return <label key={field.name} className="flex items-center gap-2"><input type="checkbox" name={field.name} defaultChecked={value === true} />{field.label}</label>;
    const choices = field.type === "media" ? state.media.filter((asset) => asset.status === "ready").map((asset) => option(asset.id, asset.altText || asset.key)) : field.options;
    return <div key={field.name} className={`space-y-1.5 ${field.type === "textarea" || field.type === "lines" ? "sm:col-span-2" : ""}`}><Label htmlFor={`cms-${field.name}`}>{field.label}{field.required ? " *" : ""}</Label>{choices ? <select id={`cms-${field.name}`} name={field.name} required={field.required} defaultValue={String(value ?? "")} className="h-10 w-full rounded-md border border-ink/25 bg-white px-3"><option value="">নির্বাচন করুন</option>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : field.type === "textarea" || field.type === "lines" ? <Textarea id={`cms-${field.name}`} name={field.name} rows={field.type === "textarea" ? 5 : 4} defaultValue={Array.isArray(value) ? value.join("\n") : String(value ?? "")} /> : <Input id={`cms-${field.name}`} name={field.name} type={field.type === "number" || field.type === "email" ? field.type : "text"} required={field.required} defaultValue={String(value ?? (field.type === "number" && !field.nullable ? 0 : ""))} />}</div>;
  })}</div><div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}</Button>{existingId && ["pages", "sections", "gallery"].includes(kind) && <Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>{kind === "pages" ? "প্রকাশ বন্ধ করুন" : "মুছুন"}</Button>}</div></form>;
}

const timeValue = (minute: number) => `${String(Math.floor((minute % 1440) / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const toMinute = (value: FormDataEntryValue | null) => { const [hour, minute] = String(value).split(":").map(Number); return hour * 60 + minute; };
function HoursForm({ state, saved }: { state: ContentState; saved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const values = new FormData(event.currentTarget);
    const body = DAYS.map((_, weekday) => ({ weekday, closed: values.has(`closed-${weekday}`), opensAtMinute: toMinute(values.get(`open-${weekday}`)), closesAtMinute: toMinute(values.get(`close-${weekday}`)) || 1440, slotMinutes: Number(values.get(`slot-${weekday}`)) }));
    try { await requestJson("/api/v1/admin/content/hours", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); toast.success("কর্মঘণ্টা সংরক্ষিত হয়েছে।"); await saved(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "কর্মঘণ্টা সংরক্ষণ হয়নি।"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="paper-card space-y-5 p-5"><p className="text-sm text-ink-3">এই সময় অনুযায়ী অ্যাপয়েন্টমেন্টের স্লট তৈরি হবে। বন্ধের সময় 00:00 দিলে মধ্যরাত বোঝায়।</p>{DAYS.map((label, weekday) => { const row = state.hours.find((entry) => entry.weekday === weekday); return <fieldset key={weekday} className="grid gap-3 rounded-md border border-ink/10 p-4 sm:grid-cols-4"><legend className="px-2 font-medium">{label}</legend><label className="flex items-center gap-2"><input type="checkbox" name={`closed-${weekday}`} defaultChecked={row?.closed ?? true} />বন্ধ</label><div><Label htmlFor={`open-${weekday}`}>খোলে</Label><Input id={`open-${weekday}`} name={`open-${weekday}`} type="time" required defaultValue={row ? timeValue(row.opensAtMinute) : ""} /></div><div><Label htmlFor={`close-${weekday}`}>বন্ধ হয়</Label><Input id={`close-${weekday}`} name={`close-${weekday}`} type="time" required defaultValue={row ? timeValue(row.closesAtMinute) : ""} /></div><div><Label htmlFor={`slot-${weekday}`}>স্লট (মিনিট)</Label><Input id={`slot-${weekday}`} name={`slot-${weekday}`} type="number" min={5} max={120} required defaultValue={row?.slotMinutes ?? ""} /></div></fieldset>; })}<Button disabled={busy}>{busy ? "সংরক্ষণ হচ্ছে…" : "কর্মঘণ্টা সংরক্ষণ করুন"}</Button></form>;
}

function MediaPanel({ state, saved }: { state: ContentState; saved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const assets = state.media.filter((asset) => asset.status !== "archived");
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    for (const key of ["key", "assetId"]) if (!data.get(key)) data.delete(key);
    setBusy(true);
    try { await requestJson("/api/v1/admin/media", { method: "POST", body: data }); toast.success("ছবি সংরক্ষিত হয়েছে।"); form.reset(); await saved(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "ছবি সংরক্ষণ হয়নি।"); }
    finally { setBusy(false); }
  }
  async function change(id: string, method: "PATCH" | "DELETE", body?: unknown) {
    if (method === "DELETE" && !window.confirm("এই ছবিটি মুছবেন?")) return;
    setBusy(true);
    try { await requestJson(`/api/v1/admin/media/${id}`, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) }); toast.success(method === "DELETE" ? "ছবি সরানো হয়েছে।" : "বর্ণনা সংরক্ষিত হয়েছে।"); await saved(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "ছবির পরিবর্তন হয়নি।"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><form onSubmit={upload} className="paper-card space-y-4 p-5"><h2 className="text-xl">ছবি আপলোড বা প্রতিস্থাপন</h2><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="media-file">ছবি *</Label><Input id="media-file" type="file" name="file" accept="image/png,image/jpeg,image/webp" required /></div><div><Label htmlFor="media-asset">প্রতিস্থাপন করুন</Label><select id="media-asset" name="assetId" className="h-10 w-full rounded-md border border-ink/25 bg-white px-3"><option value="">নতুন ছবি</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.altText || asset.key}</option>)}</select></div><div><Label htmlFor="media-key">পরিচয় (ঐচ্ছিক)</Label><Input id="media-key" name="key" pattern="[a-z0-9][a-z0-9_-]{1,79}" /></div><div><Label htmlFor="media-alt">ছবির বর্ণনা</Label><Input id="media-alt" name="altText" maxLength={500} /></div></div><Button disabled={busy}>{busy ? "আপলোড হচ্ছে…" : "ছবি আপলোড করুন"}</Button></form><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{assets.map((asset) => <article key={asset.id} className="paper-card overflow-hidden">{asset.secureUrl && <Image src={asset.secureUrl} width={800} height={600} alt={asset.altText || asset.key} sizes="(max-width: 640px) 100vw, 33vw" className="h-44 w-full object-cover" />}<div className="space-y-3 p-4"><div className="font-medium">{asset.key}</div><p className="break-all text-xs text-stone">{asset.originalFileName} · {asset.status}</p><form onSubmit={(event) => { event.preventDefault(); void change(asset.id, "PATCH", { altText: String(new FormData(event.currentTarget).get("altText") || "") }); }} className="space-y-2"><Label htmlFor={`asset-${asset.id}`}>বর্ণনা</Label><Input id={`asset-${asset.id}`} name="altText" defaultValue={asset.altText} maxLength={500} /><div className="flex gap-2"><Button size="sm" disabled={busy}>সংরক্ষণ</Button><Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void change(asset.id, "DELETE")}>মুছুন</Button></div></form></div></article>)}</div>{!assets.length && <p className="paper-card p-5 text-ink-3">এখনো কোনো ছবি যোগ করা হয়নি।</p>}</div>;
}

export function ContentManager({ initial }: { initial: ContentState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [kind, setKind] = useState<Kind>("shop");
  const [selected, setSelected] = useState("");
  const [version, setVersion] = useState(0);
  async function reload() { const result = await requestJson<{ data: ContentState }>("/api/v1/admin/content"); setState(result.data); setVersion((value) => value + 1); router.refresh(); }
  const records: { id: string; label: string; record: Record<string, unknown> }[] = kind === "pages" ? state.pages.map((row) => ({ id: row.slug, label: row.title, record: row })) : kind === "sections" ? state.sections.map((row) => ({ id: row.id, label: `${row.pageSlug} · ${row.heading || row.kind}`, record: row })) : kind === "services" ? state.services.map((row) => ({ id: row.garmentTypeId, label: state.garments.find((garment) => garment.id === row.garmentTypeId)?.nameBn || row.garmentTypeId, record: row })) : kind === "gallery" ? state.gallery.map((row) => ({ id: row.id, label: row.title, record: row })) : [];
  const record = kind === "shop" ? state.shop || {} : records.find((row) => row.id === selected)?.record || {};
  return <div className="space-y-6"><nav className="flex flex-wrap gap-2" aria-label="সাইটের তথ্য"><>{KINDS.map(([value, label]) => <Button key={value} variant={kind === value ? "default" : "outline"} onClick={() => { setKind(value); setSelected(""); }}>{label}</Button>)}</></nav>{!["shop", "hours", "media"].includes(kind) && <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Label htmlFor="content-record">তথ্য নির্বাচন করুন</Label><select id="content-record" value={selected} onChange={(event) => setSelected(event.target.value)} className="h-10 w-full rounded-md border border-ink/25 bg-white px-3"><option value="">নতুন তথ্য</option>{records.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></div><Button variant="outline" onClick={() => setSelected("")}>নতুন যোগ করুন</Button></div>}{kind === "media" ? <MediaPanel key={`media-${version}`} state={state} saved={reload} /> : kind === "hours" ? <HoursForm key={`hours-${version}`} state={state} saved={reload} /> : <ContentForm key={`${kind}-${selected}-${version}`} kind={kind} record={record} state={state} saved={reload} />}</div>;
}
