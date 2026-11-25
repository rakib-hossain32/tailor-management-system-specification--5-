import type { PublicSection } from "@/server/cms/types";

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function headerFor(sections: PublicSection[], key: string) {
  return sections.find((section) => {
    const data = asRecord(section.data);
    return data.sectionHeader === true && data.sectionKey === key;
  });
}

export function homeSections(sections: PublicSection[], kind: string) {
  return sections
    .filter((section) => section.kind === kind)
    .sort((left, right) => left.position - right.position);
}
