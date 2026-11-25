import "server-only";
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { ApiError, isUuid } from "@/lib/api-route";
import { isValidBdPhone, normalizePhone } from "@/lib/format";
import { text } from "@/lib/api-input";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type PersonInput = {
  name?: unknown; phone?: unknown; altPhone?: unknown; email?: unknown;
  address?: unknown; birthDate?: unknown; gender?: unknown; bodyNotes?: unknown;
};

function optionalText(value: unknown, label: string, max: number) {
  return value == null || value === "" ? null : text(value, label, max) || null;
}
function phoneValue(value: unknown) {
  if (value == null || value === "") return null;
  const raw = text(value, "ফোন নম্বর", 40) ?? "";
  const phone = normalizePhone(raw);
  if (!isValidBdPhone(phone)) throw new ApiError(422, "VALIDATION_ERROR", "সঠিক ফোন নম্বর দিন");
  return phone;
}
function dateValue(value: unknown) {
  if (value == null || value === "") return null;
  const date = text(value, "জন্মতারিখ", 10) ?? "";
  const parsed = new Date(date + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ApiError(422, "VALIDATION_ERROR", "জন্মতারিখ সঠিক নয়");
  }
  return date;
}

/** Reuse canonical identities; public lookups never rewrite an existing person. */
export async function resolvePerson(tx: Transaction, input: PersonInput, personId?: string) {
  const values: Partial<typeof people.$inferInsert> = {};
  if ("name" in input) {
    const name = text(input.name, "নাম", 150) ?? "";
    if (name.length < 2) throw new ApiError(422, "VALIDATION_ERROR", "অন্তত দুই অক্ষরের নাম দিন");
    values.name = name;
  }
  if ("phone" in input) values.phone = phoneValue(input.phone);
  if ("altPhone" in input) values.altPhone = phoneValue(input.altPhone);
  if ("email" in input) {
    const email = optionalText(input.email, "ইমেইল", 254)?.toLowerCase() ?? null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(422, "VALIDATION_ERROR", "সঠিক ইমেইল দিন");
    values.email = email;
  }
  if ("address" in input) values.address = optionalText(input.address, "ঠিকানা", 1000);
  if ("bodyNotes" in input) values.bodyNotes = optionalText(input.bodyNotes, "শারীরিক নোট", 2000);
  if ("gender" in input) {
    const gender = optionalText(input.gender, "লিঙ্গ", 30);
    if (gender && !["male", "female", "other"].includes(gender)) throw new ApiError(422, "VALIDATION_ERROR", "লিঙ্গ সঠিক নয়");
    values.gender = gender;
  }
  if ("birthDate" in input) values.birthDate = dateValue(input.birthDate);
  if (personId && !isUuid(personId)) throw new ApiError(422, "VALIDATION_ERROR", "ব্যক্তির পরিচয় সঠিক নয়");
  const lockKeys = [
    personId ? "person:id:" + personId : null,
    values.phone ? "person:phone:" + values.phone : null,
    values.email ? "person:email:" + values.email : null,
  ].filter((key): key is string => Boolean(key)).sort();
  for (const key of lockKeys) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  const matching = values.phone || values.email
    ? await tx.select().from(people).where(or(values.phone ? eq(people.phone, values.phone) : undefined, values.email ? sql`lower(${people.email}) = ${values.email}` : undefined))
    : [];
  if (new Set(matching.map((person) => person.id)).size > 1 || (personId && matching.some((person) => person.id !== personId))) {
    throw new ApiError(409, "IDENTITY_CONFLICT", "ফোন ও ইমেইল অন্য ব্যক্তির সঙ্গে যুক্ত আছে");
  }
  if (personId) {
    const [current] = await tx.select().from(people).where(eq(people.id, personId)).for("update");
    if (!current) throw new ApiError(404, "NOT_FOUND", "ব্যক্তি পাওয়া যায়নি");
    if (!Object.keys(values).length) return current;
    const [updated] = await tx.update(people).set({ ...values, updatedAt: new Date() }).where(eq(people.id, personId)).returning();
    return updated;
  }
  if (matching[0]) return matching[0];
  if (!values.name) throw new ApiError(422, "VALIDATION_ERROR", "নতুন ব্যক্তির নাম দিন");
  const [created] = await tx.insert(people).values({ ...values, name: values.name }).returning();
  return created;
}
