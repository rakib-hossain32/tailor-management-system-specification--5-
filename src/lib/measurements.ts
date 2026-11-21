/**
 * Measurement data-quality controls (PRD 4.4).
 * Pure functions — no DB access, unit-testable.
 */
import { cmToInch } from "./units";

export interface SchemaField {
  key: string;
  label_bn: string;
  label_en: string;
  type: "measurement" | "number" | "select" | "multiselect" | "boolean" | "text";
  required: boolean;
  min?: number;
  max?: number;
  help_bn?: string;
  diagram_hint?: string;
  order?: number;
}

export interface SchemaGroup {
  key: string;
  label_bn: string;
  label_en: string;
  fields: SchemaField[];
}

export interface ValidationRule {
  type: "ratio" | "compare";
  fields: string[];
  min?: number;
  max?: number;
  max_of?: string[];
  divisor?: number;
  slack?: number;
  severity: "warning" | "error";
  message_bn: string;
}

export interface MeasurementSchema {
  version: number;
  unit: "cm";
  groups: SchemaGroup[];
  validation_rules: ValidationRule[];
}

export interface StyleOption {
  key: string;
  label_bn: string;
  type: "select" | "multiselect" | "boolean" | "text";
  choices?: { value: string; label_bn: string }[];
}

export interface StyleSchema {
  options: StyleOption[];
}

export interface Issue {
  field?: string;
  severity: "warning" | "error";
  message_bn: string;
}

export function flattenFields(schema: MeasurementSchema | null | undefined): SchemaField[] {
  if (!schema?.groups) return [];
  return schema.groups
    .flatMap((g) => g.fields ?? [])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Validate stored centimetre values against the garment schema.
 * Range violations are warnings (unusual bodies are legitimate), rules are
 * configurable severity — `error` blocks the save, `warning` does not.
 */
export function validateMeasurementValues(
  schema: MeasurementSchema | null | undefined,
  values: Record<string, number>,
): Issue[] {
  const issues: Issue[] = [];
  const fields = flattenFields(schema);

  for (const field of fields) {
    const raw = values[field.key];
    if (raw == null || Number.isNaN(raw)) {
      if (field.required) {
        issues.push({
          field: field.key,
          severity: "error",
          message_bn: `${field.label_bn} মাপটি আবশ্যক`,
        });
      }
      continue;
    }
    if (field.min != null && raw < field.min) {
      issues.push({
        field: field.key,
        severity: "warning",
        message_bn: `${field.label_bn} ${field.min} সেমির নিচে (${raw} সেমি) — আবার যাচাই করুন`,
      });
    }
    if (field.max != null && raw > field.max) {
      issues.push({
        field: field.key,
        severity: "warning",
        message_bn: `${field.label_bn} ${field.max} সেমির বেশি (${raw} সেমি) — আবার যাচাই করুন`,
      });
    }
  }

  for (const rule of schema?.validation_rules ?? []) {
    if (rule.type === "ratio") {
      const [a, b] = rule.fields;
      const va = values[a];
      const vb = values[b];
      if (va && vb && vb !== 0) {
        const ratio = va / vb;
        if (rule.min != null && ratio < rule.min) {
          issues.push({ field: a, severity: rule.severity, message_bn: rule.message_bn });
        } else if (rule.max != null && ratio > rule.max) {
          issues.push({ field: a, severity: rule.severity, message_bn: rule.message_bn });
        }
      }
    }
    if (rule.type === "compare") {
      const target = values[rule.fields[0]];
      const otherKey = rule.max_of?.[0];
      const other = otherKey ? values[otherKey] : undefined;
      if (target && other) {
        const limit = other / (rule.divisor ?? 1) + (rule.slack ?? 0);
        if (target > limit) {
          issues.push({ field: rule.fields[0], severity: rule.severity, message_bn: rule.message_bn });
        }
      }
    }
  }

  return issues;
}

/** Human diff between two measurement sets, in inches (tailors think in inches). */
export function diffMeasurements(
  base: Record<string, number>,
  next: Record<string, number>,
  labels: Record<string, string>,
): { key: string; label: string; from: number; to: number; delta: number }[] {
  const keys = new Set([...Object.keys(base), ...Object.keys(next)]);
  const out: { key: string; label: string; from: number; to: number; delta: number }[] = [];
  for (const key of keys) {
    const a = base[key];
    const b = next[key];
    if (a == null || b == null) continue;
    const delta = Math.round((cmToInch(b) - cmToInch(a)) * 100) / 100;
    if (Math.abs(delta) < 0.01) continue;
    out.push({ key, label: labels[key] ?? key, from: Math.round(cmToInch(a) * 100) / 100, to: Math.round(cmToInch(b) * 100) / 100, delta });
  }
  return out;
}

/** Plausibility hints used by the entry screen (never blocks the save). */
export function sanityHints(values: Record<string, number>): string[] {
  const hints: string[] = [];
  const { chest, waist, shoulder, length, neck } = values;
  if (chest && waist && waist / chest > 0.98) {
    hints.push("কোমর বুকের প্রায় সমান — মাপ গ্রহণের সময় নিশ্চিত হয়েছেন কি?");
  }
  if (shoulder && chest && shoulder > chest / 2 + 6) {
    hints.push("কাঁধ বুকের অর্ধেকের চেয়ে অনেক বড় — পিঠের মাপ হতে পারে, আবার মাপুন।");
  }
  if (length && neck && length < neck) {
    hints.push("লম্বা ও গলার মাপ সম্ভাব্যভাবে উল্টো হয়েছে।");
  }
  return hints;
}
