import "server-only";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerAccounts, customers, measurementProfiles, measurementSets, orders, profileMemberships } from "@/db/schema";
import { viewFields } from "@/server/repositories/views";
import { ApiError } from "@/lib/api-route";
import { text } from "@/lib/api-input";
import { formatPhone } from "@/lib/format";
import { recordAudit } from "@/server/audit";
import { resolvePerson } from "@/server/repositories/people";
import { authorize, bool, changedFields, page, personFields, present, strings, uuid, type Actor, type Input, type ListOptions } from "./ops-common";

const summaryFields = {
  ...viewFields(customers),
  open_due: sql<string>`coalesce((select sum(${orders.dueAmount}) from ${orders} where ${orders.customerId} = ${customers.id} and ${orders.status} not in ('delivered','cancelled')),0)`,
  order_count: sql<number>`(select count(*)::int from ${orders} where ${orders.customerId} = ${customers.id})`,
};

function normalized(input: Input): Input {
  const result = { ...input };
  for (const [from, to] of Object.entries({ alt_phone: "altPhone", birth_date: "birthDate", body_notes: "bodyNotes", sms_opt_in: "smsOptIn", portal_enabled: "portalEnabled", is_active: "isActive", person_id: "personId", profile_name: "profileName" })) if (from in input && !(to in input)) result[to] = input[from];
  return result;
}

export async function listCustomers(actor: Actor, options?: ListOptions & { includeArchived?: boolean }) {
  authorize(actor);
  const p = page(options), digits = p.q.replace(/\D/g, "");
  const filter = and(options?.includeArchived ? undefined : eq(customers.isActive, true), p.q ? or(ilike(customers.name, "%" + p.q + "%"), ilike(customers.phone, "%" + p.q + "%"), digits ? ilike(customers.phone, "%" + digits + "%") : undefined) : undefined);
  const [rows, count] = await Promise.all([db.select(summaryFields).from(customers).where(filter).orderBy(asc(customers.name)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(customers).where(filter)]);
  return { rows: rows.map((row) => ({ ...row, phone: formatPhone(row.phone), open_due: Number(row.open_due) })), total: count[0].n, page: p.page, limit: p.limit };
}

export async function getCustomer(actor: Actor, id: string) {
  authorize(actor);
  const customer = present((await db.select(summaryFields).from(customers).where(eq(customers.id, uuid(id))).limit(1))[0], "কাস্টমার");
  const profiles = await db.select().from(measurementProfiles).where(and(eq(measurementProfiles.customerId, id), eq(measurementProfiles.isActive, true)));
  const sets = profiles.length ? await db.select().from(measurementSets).where(and(inArray(measurementSets.profileId, profiles.map((p) => p.id)), eq(measurementSets.isCurrent, true))) : [];
  return { ...customer, open_due: Number(customer.open_due), profiles: profiles.map((p) => ({ ...p, display_name: p.displayName, is_default: p.isDefault, sets: sets.filter((s) => s.profileId === p.id).map((s) => ({ ...s, garment_type_id: s.garmentTypeId, measured_at: s.measuredAt.toISOString() })) })) };
}

export async function createCustomer(actor: Actor, rawInput: Input) {
  authorize(actor);
  const input = normalized(rawInput), tags = strings(input.tags, "ট্যাগ", 20), notes = text(input.notes, "নোট") || null;
  const result = await db.transaction(async (tx) => {
    const person = input.personId ? await resolvePerson(tx, {}, uuid(input.personId)) : await resolvePerson(tx, personFields(input));
    if (!person.phone) throw new ApiError(422, "VALIDATION_ERROR", "কাস্টমারের ফোন নম্বর দিন");
    const [existing] = await tx.select().from(customerAccounts).where(eq(customerAccounts.personId, person.id)).limit(1);
    if (existing) return { id: existing.id, created: false };
    const [record] = await tx.insert(customerAccounts).values({ personId: person.id, tags, notes, smsOptIn: bool(input.smsOptIn), portalEnabled: bool(input.portalEnabled), isActive: true }).returning({ id: customerAccounts.id });
    const alias = text(input.profileName, "প্রোফাইলের নাম", 150) || null;
    await tx.insert(profileMemberships).values({ customerId: record.id, personId: person.id, alias, relation: "self", isDefault: true });
    await recordAudit(tx, { actorId: actor.userId, action: "create", entity: "customer", entityId: record.id, details: { personId: person.id } });
    return { id: record.id, created: true };
  });
  return { ...result, customer: await getCustomer(actor, result.id) };
}

export async function updateCustomer(actor: Actor, id: string, rawInput: Input) {
  authorize(actor);
  const customerId = uuid(id), input = normalized(rawInput);
  if ("isActive" in input) authorize(actor, "management");
  await db.transaction(async (tx) => {
    const current = present((await tx.select().from(customerAccounts).where(eq(customerAccounts.id, customerId)).for("update"))[0], "কাস্টমার");
    if (input.personId !== undefined && input.personId !== current.personId) throw new ApiError(422, "IMMUTABLE_RELATION", "কাস্টমারের ব্যক্তি বদলানো যায় না");
    const person = await resolvePerson(tx, personFields(input), current.personId);
    if (!person.phone) throw new ApiError(422, "VALIDATION_ERROR", "কাস্টমারের ফোন নম্বর প্রয়োজন");
    await tx.update(customerAccounts).set({ notes: "notes" in input ? text(input.notes, "নোট") || null : current.notes, tags: "tags" in input ? strings(input.tags, "ট্যাগ", 20) : current.tags,
      smsOptIn: bool(input.smsOptIn, current.smsOptIn), portalEnabled: bool(input.portalEnabled, current.portalEnabled), isActive: bool(input.isActive, current.isActive), updatedAt: new Date() }).where(eq(customerAccounts.id, customerId));
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "customer", entityId: customerId, details: { fields: changedFields(input) } });
  });
  return getCustomer(actor, customerId);
}

export async function archiveCustomer(actor: Actor, id: string) {
  authorize(actor, "management");
  return updateCustomer(actor, id, { isActive: false, portalEnabled: false });
}
