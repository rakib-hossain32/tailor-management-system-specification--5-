import "server-only";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerAccounts, measurementProfiles, profileMemberships } from "@/db/schema";
import { ApiError } from "@/lib/api-route";
import { text } from "@/lib/api-input";
import { recordAudit } from "@/server/audit";
import { resolvePerson } from "@/server/repositories/people";
import { authorize, bool, changedFields, page, personFields, present, uuid, type Actor, type Input, type ListOptions } from "./ops-common";

function normalized(input: Input): Input {
  const result = { ...input };
  for (const [from, to] of Object.entries({ customer_id: "customerId", person_id: "personId", display_name: "alias", displayName: "alias", birth_date: "birthDate", body_notes: "bodyNotes", is_default: "isDefault", is_active: "isActive" })) if (from in input && !(to in input)) result[to] = input[from];
  return result;
}

export async function listProfiles(actor: Actor, customerId?: string) {
  return (await listProfileRecords(actor, { customerId, limit: 100 })).rows;
}

export async function listProfileRecords(actor: Actor, options: ListOptions & { customerId?: string; includeArchived?: boolean } = {}) {
  authorize(actor);
  const p = page(options);
  const filter = and(options.includeArchived ? undefined : eq(measurementProfiles.isActive, true), options.customerId ? eq(measurementProfiles.customerId, uuid(options.customerId)) : undefined, p.q ? ilike(measurementProfiles.displayName, "%" + p.q + "%") : undefined);
  const [rows, count] = await Promise.all([db.select().from(measurementProfiles).where(filter).orderBy(asc(measurementProfiles.displayName)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(measurementProfiles).where(filter)]);
  return { rows, total: count[0].n, page: p.page, limit: p.limit };
}

export async function getProfile(actor: Actor, id: string) {
  authorize(actor);
  return present((await db.select().from(measurementProfiles).where(eq(measurementProfiles.id, uuid(id))).limit(1))[0], "মাপ প্রোফাইল");
}

export async function createProfile(actor: Actor, rawInput: Input) {
  authorize(actor);
  const input = normalized(rawInput), customerId = uuid(input.customerId, "কাস্টমার");
  const id = await db.transaction(async (tx) => {
    const customer = present((await tx.select().from(customerAccounts).where(eq(customerAccounts.id, customerId)).for("update"))[0], "কাস্টমার");
    if (!customer.isActive) throw new ApiError(409, "CUSTOMER_ARCHIVED", "নিষ্ক্রিয় কাস্টমারের নতুন প্রোফাইল তৈরি করা যায় না");
    const relation = text(input.relation, "সম্পর্ক", 50) || null;
    const person = relation === "self" ? await resolvePerson(tx, {}, customer.personId) : input.personId ? await resolvePerson(tx, {}, uuid(input.personId)) : await resolvePerson(tx, personFields(input));
    const [duplicate] = await tx.select({ id: profileMemberships.id }).from(profileMemberships).where(and(eq(profileMemberships.customerId, customerId), eq(profileMemberships.personId, person.id))).limit(1);
    if (duplicate) throw new ApiError(409, "DUPLICATE", "এই ব্যক্তির মাপ প্রোফাইল ইতিমধ্যে আছে");
    const [existingDefault] = await tx.select({ id: profileMemberships.id }).from(profileMemberships).where(and(eq(profileMemberships.customerId, customerId), eq(profileMemberships.isActive, true), eq(profileMemberships.isDefault, true))).limit(1);
    const isDefault = bool(input.isDefault, !existingDefault);
    if (isDefault) await tx.update(profileMemberships).set({ isDefault: false }).where(eq(profileMemberships.customerId, customerId));
    const [created] = await tx.insert(profileMemberships).values({ customerId, personId: person.id, alias: text(input.alias, "প্রোফাইলের নাম", 150) || null, relation, isDefault }).returning({ id: profileMemberships.id });
    await recordAudit(tx, { actorId: actor.userId, action: "create", entity: "profile", entityId: created.id, details: { customerId, personId: person.id } });
    return created.id;
  });
  return getProfile(actor, id);
}

export async function updateProfile(actor: Actor, id: string, rawInput: Input) {
  authorize(actor);
  const profileId = uuid(id), input = normalized(rawInput);
  if ("isActive" in input) authorize(actor, "management");
  await db.transaction(async (tx) => {
    const membership = present((await tx.select({ customerId: profileMemberships.customerId }).from(profileMemberships).where(eq(profileMemberships.id, profileId)).limit(1))[0], "মাপ প্রোফাইল");
    const parent = present((await tx.select().from(customerAccounts).where(eq(customerAccounts.id, membership.customerId)).for("update"))[0], "কাস্টমার");
    const current = present((await tx.select().from(profileMemberships).where(eq(profileMemberships.id, profileId)).for("update"))[0], "মাপ প্রোফাইল");
    if ((input.personId !== undefined && input.personId !== current.personId) || (input.customerId !== undefined && input.customerId !== current.customerId)) throw new ApiError(422, "IMMUTABLE_RELATION", "প্রোফাইলের ব্যক্তি বা কাস্টমার বদলানো যায় না");
    await resolvePerson(tx, personFields(input), current.personId);
    const isActive = bool(input.isActive, current.isActive);
    if (isActive && !parent.isActive) throw new ApiError(409, "CUSTOMER_ARCHIVED", "নিষ্ক্রিয় কাস্টমারের প্রোফাইল সক্রিয় করা যায় না");
    const others = await tx.select().from(profileMemberships).where(and(eq(profileMemberships.customerId, current.customerId), eq(profileMemberships.isActive, true), sql`${profileMemberships.id} <> ${profileId}`));
    if (!isActive && !others.length) throw new ApiError(409, "LAST_PROFILE", "কাস্টমারের অন্তত একটি সক্রিয় মাপ প্রোফাইল থাকতে হবে");
    const isDefault = isActive && bool(input.isDefault, current.isDefault || !others.some((p) => p.isDefault));
    if (isActive && !isDefault && !others.some((p) => p.isDefault)) {
      if (!others.length) throw new ApiError(409, "DEFAULT_PROFILE_REQUIRED", "একটি ডিফল্ট প্রোফাইল প্রয়োজন");
      await tx.update(profileMemberships).set({ isDefault: false }).where(eq(profileMemberships.customerId, current.customerId));
      await tx.update(profileMemberships).set({ isDefault: true }).where(eq(profileMemberships.id, others[0].id));
    }
    if (isDefault) await tx.update(profileMemberships).set({ isDefault: false }).where(eq(profileMemberships.customerId, current.customerId));
    await tx.update(profileMemberships).set({ alias: "alias" in input ? text(input.alias, "প্রোফাইলের নাম", 150) || null : current.alias, relation: "relation" in input ? text(input.relation, "সম্পর্ক", 50) || null : current.relation, isActive, isDefault, updatedAt: new Date() }).where(eq(profileMemberships.id, profileId));
    if (!isActive && current.isDefault && others.length) await tx.update(profileMemberships).set({ isDefault: true }).where(eq(profileMemberships.id, others[0].id));
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "profile", entityId: profileId, details: { fields: changedFields(input) } });
  });
  return getProfile(actor, profileId);
}

export async function archiveProfile(actor: Actor, id: string) {
  authorize(actor, "management");
  return updateProfile(actor, id, { isActive: false });
}
