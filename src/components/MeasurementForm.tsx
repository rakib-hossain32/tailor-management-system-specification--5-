"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutationError } from "@/components/feedback/FeedbackProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GarmentDiagram } from "./GarmentDiagram";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDelta,
  formatMeasurement,
  parseMeasurementInput,
  toCm,
  type Unit,
} from "@/lib/units";
import {
  sanityHints,
  validateMeasurementValues,
  type MeasurementSchema,
  type StyleSchema,
} from "@/lib/measurements";

export interface FormProfile {
  id: string;
  displayName: string;
  relation: string | null;
  birthDate: string | null;
  bodyNotes: string | null;
}

export interface FormGarment {
  id: string;
  code: string;
  nameBn: string;
  category: string;
  schema: MeasurementSchema;
  styleSchema: StyleSchema;
  defaultDeliveryDays: number;
  basePrice: number;
}

export interface LatestSet {
  id: string;
  version: number;
  values: Record<string, number>;
  styles: Record<string, string>;
  measuredAt: string;
  source: string;
  verified: boolean;
}

const SOURCES = [
  { value: "in_store", label: "M1 · দোকানে সরাসরি মাপ" },
  { value: "reused", label: "M2 · পুরনো মাপ পুনর্ব্যবহার" },
  { value: "fit_adjusted", label: "M3 · ফিট-কারেকশন" },
  { value: "from_garment", label: "M4 · রেফারেন্স পোশাক থেকে" },
  { value: "self_reported", label: "M7 · কাস্টমারের স্ব-মাপ" },
  { value: "remote_assisted", label: "M8 · ভিডিও কলে মাপ" },
  { value: "standard_size", label: "M9 · স্ট্যান্ডার্ড সাইজ" },
];

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function measurementInputs(garment: FormGarment | undefined, set: LatestSet | undefined, unit: Unit) {
  const values: Record<string, string> = {};
  for (const field of (garment?.schema.groups ?? []).flatMap((group) => group.fields)) {
    const stored = set?.values[field.key];
    values[field.key] = stored != null ? formatMeasurement(stored, unit) : "";
  }
  return values;
}

export function MeasurementForm({
  customerId,
  profiles,
  garments,
  initialProfileId,
  initialGarmentId,
  returnTo,
  latest,
  measuredBy,
}: {
  customerId: string;
  profiles: FormProfile[];
  garments: FormGarment[];
  initialProfileId?: string;
  initialGarmentId?: string;
  returnTo?: string | null;
  latest: Record<string, LatestSet | undefined>;
  measuredBy?: string;
}) {
  const router = useRouter();
  const [profileId, setProfileId] = useState(initialProfileId ?? profiles[0]?.id ?? "");
  const [garmentId, setGarmentId] = useState(initialGarmentId ?? garments[0]?.id ?? "");
  const [unit, setUnit] = useState<Unit>("inch");
  const [values, setValues] = useState<Record<string, string>>(() =>
    measurementInputs(
      garments.find((g) => g.id === garmentId),
      latest[`${profileId}|${garmentId}`],
      unit,
    ),
  );
  const [styles, setStyles] = useState<Record<string, string>>(
    () => latest[`${profileId}|${garmentId}`]?.styles ?? {},
  );
  const [source, setSource] = useState("in_store");
  const [notes, setNotes] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [active, setActive] = useState<{ key: string; hint?: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useMutationError();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const garment = garments.find((g) => g.id === garmentId) ?? garments[0];
  const profile = profiles.find((p) => p.id === profileId);
  const prev = latest[`${profileId}|${garmentId}`];

  const fields = useMemo(() => {
    if (!garment) return [];
    return (garment.schema.groups ?? [])
      .flatMap((g) => g.fields)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [garment]);

  function selectMeasurement(nextProfileId: string, nextGarmentId: string) {
    const set = latest[`${nextProfileId}|${nextGarmentId}`];
    setProfileId(nextProfileId);
    setGarmentId(nextGarmentId);
    setValues(measurementInputs(garments.find((g) => g.id === nextGarmentId), set, unit));
    setStyles(set?.styles ?? {});
    setActive(null);
    setError(null);
  }

  function changeUnit(nextUnit: Unit) {
    if (nextUnit === unit) return;
    const next: Record<string, string> = {};
    for (const [key, raw] of Object.entries(values)) {
      const parsed = parseMeasurementInput(raw);
      next[key] = raw.trim() !== "" && Number.isFinite(parsed)
        ? formatMeasurement(toCm(parsed, unit), nextUnit)
        : raw;
    }
    setValues(next);
    setUnit(nextUnit);
  }

  const cmValues = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseMeasurementInput(v);
      if (Number.isFinite(n) && v.trim() !== "") out[k] = toCm(n, unit);
    }
    return out;
  }, [values, unit]);

  const issues = useMemo(
    () => (garment ? validateMeasurementValues(garment.schema, cmValues) : []),
    [garment, cmValues],
  );
  const blocking = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const hints = useMemo(() => sanityHints(cmValues), [cmValues]);

  const diagramKind: "top" | "bottom" =
    garment && ["pant", "pajama"].includes(garment.code) ? "bottom" : "top";

  function setValue(fieldKey: string, raw: string) {
    setValues((v) => ({ ...v, [fieldKey]: raw }));
  }

  function focusNext(fieldKey: string) {
    const idx = fields.findIndex((f) => f.key === fieldKey);
    const nextField = fields[idx + 1];
    if (nextField) inputRefs.current[nextField.key]?.focus();
  }

  function appendFraction(fieldKey: string, frac: string) {
    const cur = values[fieldKey] ?? "";
    setValue(fieldKey, cur.endsWith(frac) ? cur.slice(0, -1) : `${cur}${frac}`);
    inputRefs.current[fieldKey]?.focus();
  }

  async function save() {
    if (blocking.length > 0) {
      setError(blocking[0].message_bn);
      return;
    }
    if (Object.keys(cmValues).length === 0) {
      setError("অন্তত একটি মাপ লিখুন");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/v1/measurements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          garment_type_id: garmentId,
          unit_entered: unit,
          values,
          styles,
          source,
          notes: notes || undefined,
          change_note: changeNote || undefined,
          based_on_set_id: prev?.id ?? null,
          measured_by: measuredBy ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "মাপ সেভ হয়নি");
      } else {
        const warn = data.warnings?.length ? ` · ${data.warnings.length}টি সতর্কতা` : "";
        setSavedMsg(`✓ মাপ v${data.version} সেভ হয়েছে${warn}`);
        toast.success(`মাপ v${data.version} সংরক্ষিত হয়েছে${warn}`);
        setTimeout(() => router.push(returnTo ?? `/admin/customers/${customerId}`), 900);
        setTimeout(() => router.refresh(), 950);
      }
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন");
    } finally {
      setSaving(false);
    }
  }

  const prevAge = prev ? ageDays(prev.measuredAt) : null;

  return (
    <div className="space-y-5">
      {/* controls */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-5">
          <div className="space-y-1.5">
            <Label>মাপ কার (প্রোফাইল)</Label>
            <Select value={profileId} onValueChange={(id) => selectMeasurement(id, garmentId)}>
              <SelectTrigger className="min-w-[200px]" aria-label="মাপ কার">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName}
                    {p.relation && p.relation !== "self" ? ` (${p.relation})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>পোশাকের ধরন</Label>
            <Select value={garmentId} onValueChange={(id) => selectMeasurement(profileId, id)}>
              <SelectTrigger className="min-w-[200px]" aria-label="পোশাকের ধরন">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {garments.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nameBn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>মাপ নেওয়ার উৎস</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="min-w-[240px]" aria-label="মাপের উৎস">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto space-y-1.5">
            <Label>ইউনিট</Label>
            <div className="flex overflow-hidden rounded-md border border-ink/30">
              {(["inch", "cm"] as Unit[]).map((u) => (
                <Button
                  key={u}
                  type="button"
                  variant={unit === u ? "default" : "ghost"}
                  size="sm"
                  className="h-10 rounded-none px-5"
                  onClick={() => changeUnit(u)}
                >
                  {u === "inch" ? "ইঞ্চি" : "সেমি"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>

        <Separator />

        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          {prev ? (
            <>
              <Badge>আগের মাপ v{prev.version}</Badge>
              <span className="text-[14.5px] text-ink-3">
                নেওয়া হয়েছে {new Date(prev.measuredAt).toLocaleDateString("en-GB")} ({prevAge} দিন আগে) ·{" "}
                {prev.verified ? "✓ যাচাইকৃত" : "অযাচাইকৃত"}
              </span>
              {prevAge !== null && prevAge > 365 && (
                <Badge variant="destructive">১ বছার বেশি পুরনো — আবার মাপার পরামর্শ</Badge>
              )}
            </>
          ) : (
            <Badge variant="gold">এই পোশাকের জন্য কোনো মাপ নেই — প্রথমবার নিচ্ছেন</Badge>
          )}
          {profile?.bodyNotes && <span className="text-ink-3">শারীরিক নোট: {profile.bodyNotes}</span>}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* diagram */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="text-base">কোথায় মাপ নিতে হয়</CardTitle>
          </CardHeader>
          <CardContent>
            <GarmentDiagram
              kind={diagramKind}
              activeHint={active?.hint ?? active?.key}
              activeLabel={active?.label}
            />
            <p className="mt-2 text-[13.5px] text-ink-3">
              {active
                ? `${active.label} — প্রাসঙ্গিক অংশ হাইলাইট করা হয়েছে`
                : "ফিল্ডে ক্লিক করলে সেই অংশ প্রসঙ্গে দেখাবে।"}
            </p>
            {prev && (
              <div className="mt-3 border-t border-dashed border-stone/50 pt-3">
                <div className="smallcaps mb-1.5 text-stone">আগের মাপ (সংক্ষিপ্ত)</div>
                <ul className="space-y-1 text-[13.5px]">
                  {fields.slice(0, 5).map((f) => {
                    const before = prev.values?.[f.key];
                    const now = cmValues[f.key];
                    return (
                      <li key={f.key} className="flex justify-between gap-2">
                        <span className="text-ink-3">{f.label_bn}</span>
                        <span className="num">
                          {formatMeasurement(before, unit)}
                          {now != null && before != null && (
                            <span className="ml-1.5 text-chalk">{formatDelta(now - before, unit)}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* fields */}
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="text-2xl">{garment?.nameBn} — মাপের ফর্ম</CardTitle>
            <span className="text-[13.5px] text-stone">
              ডিফল্ট ডেলিভারি {garment?.defaultDeliveryDays} দিন · শুরু{" "}
              <span className="num">৳{Number(garment?.basePrice ?? 0).toLocaleString("en-US")}</span>
            </span>
          </CardHeader>
          <CardContent className="space-y-6">
            {(garment?.schema.groups ?? []).map((group) => (
              <fieldset key={group.key}>
                <legend className="smallcaps mb-3 w-full border-b border-ink/15 pb-1.5 text-stone">
                  {group.label_bn}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.fields
                    .slice()
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((f) => {
                      const before = prev?.values?.[f.key];
                      const now = cmValues[f.key];
                      const delta = before != null && now != null ? now - before : null;
                      const isWrong = issues.some((i) => i.field === f.key);
                      return (
                        <div
                          key={f.key}
                          className={`rounded-md border p-2.5 transition-colors ${
                            active?.key === f.key
                              ? "border-gold-dark bg-gold-light/40"
                              : isWrong
                                ? "border-chalk/50"
                                : "border-envelope"
                          }`}
                        >
                          <Label
                            htmlFor={`f-${f.key}`}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <span>
                              {f.label_bn}
                              {f.required && <span className="text-chalk">*</span>}
                            </span>
                            {f.help_bn && (
                              <span title={f.help_bn} className="cursor-help text-[12px] text-stone">
                                ?
                              </span>
                            )}
                          </Label>

                          <div className="mt-1.5 flex items-center gap-1.5">
                            <Input
                              id={`f-${f.key}`}
                              ref={(el) => {
                                inputRefs.current[f.key] = el;
                              }}
                              value={values[f.key] ?? ""}
                              inputMode="decimal"
                              placeholder="—"
                              aria-invalid={isWrong || undefined}
                              onChange={(e) => setValue(f.key, e.target.value)}
                              onFocus={() => setActive({ key: f.key, hint: f.diagram_hint, label: f.label_bn })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  focusNext(f.key);
                                }
                              }}
                              className="num h-11 px-2.5 text-[22px]"
                            />
                            <span className="num text-[13px] text-stone">{unit === "inch" ? "″" : "সেমি"}</span>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <div className="flex gap-1">
                              {["¼", "½", "¾"].map((fr) => (
                                <Button
                                  key={fr}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="num h-7 w-8 px-0 text-[13px]"
                                  onClick={() => appendFraction(f.key, fr)}
                                  aria-label={`ভগ্নাংশ ${fr} যোগ করুন`}
                                >
                                  {fr}
                                </Button>
                              ))}
                            </div>
                            <span className="text-[12.5px]">
                              {delta != null && Math.abs(delta) > 0.1 ? (
                                <span className="num text-chalk">{formatDelta(delta, unit)}</span>
                              ) : before != null ? (
                                <span className="num text-stone">আগে {formatMeasurement(before, unit)}</span>
                              ) : (
                                <span className="text-stone">নতুন</span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </fieldset>
            ))}

            {(garment?.styleSchema.options ?? []).length > 0 && (
              <fieldset>
                <legend className="smallcaps mb-3 w-full border-b border-ink/15 pb-1.5 text-stone">
                  স্টাইল / ডিজাইন অপশন
                </legend>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(garment?.styleSchema.options ?? []).map((opt) => (
                    <div key={opt.key} className="space-y-1.5">
                      <Label>{opt.label_bn}</Label>
                      <Select
                        value={styles[opt.key] ?? ""}
                        onValueChange={(v) => setStyles((s) => ({ ...s, [opt.key]: v }))}
                      >
                        <SelectTrigger aria-label={opt.label_bn}>
                          <SelectValue placeholder="— বাছুন" />
                        </SelectTrigger>
                        <SelectContent>
                          {(opt.choices ?? []).map((ch) => (
                            <SelectItem key={ch.value} value={ch.value}>
                              {ch.label_bn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mf-notes">মাস্টারের নোট</Label>
                <Textarea
                  id="mf-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="যেমন: ডান কাঁধ সামান্য নিচু, ভুঁড়ির জন্য ঢিলা"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mf-change">পরিবর্তনের কারণ (নতুন ভার্সনে)</Label>
                <Textarea
                  id="mf-change"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  rows={2}
                  placeholder="যেমন: ট্রায়ালে কোমর ১ ইঞ্চি ঢিলা"
                />
              </div>
            </div>

            {warnings.length > 0 || hints.length > 0 ? (
              <ul className="space-y-1.5">
                {[...warnings.map((w) => w.message_bn), ...hints].map((m) => (
                  <li key={m}>
                    <Alert variant="warning">
                      <AlertDescription>⚠ {m}</AlertDescription>
                    </Alert>
                  </li>
                ))}
              </ul>
            ) : null}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>মাপ সেভ হয়নি</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {savedMsg && (
              <Alert variant="success">
                <AlertDescription>{savedMsg}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-ink/15 pt-4">
              <Button type="button" size="lg" onClick={save} disabled={saving || blocking.length > 0}>
                {saving ? "সেভ হচ্ছে…" : "নতুন ভার্সন হিসেবে সেভ করুন"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.push(returnTo ?? `/admin/customers/${customerId}`)}
              >
                বাতিল
              </Button>
              <span className="text-[13.5px] text-stone">
                মাপ কখনো মুছে/বদলে ফেলা হয় না — প্রতিবার নতুন ভার্সন তৈরি হবে।
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
