import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { userAccounts, workerProfiles, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { ApiError } from "@/lib/api-route";
import { recordAudit } from "@/server/audit";
import { resolvePerson } from "@/server/repositories/people";
import { authorize, bool, changedFields, choice, page, personFields, present, searchTerms, activeTerm, labelTerm, uuid, type Actor, type Input, type ListOptions } from "./ops-common";

const ROLES = ["owner", "manager", "reception", "master", "worker"];
const safeFields = { id: users.id, personId: users.personId, name: users.name, phone: users.phone, email: users.email, role: users.role, isActive: users.isActive, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt, updatedAt: users.updatedAt };
function passwordHash(value: unknown, required = false) {
  if (value === undefined || value === "") {
    if (required) throw new ApiError(422, "VALIDATION_ERROR", "অন্তত দশ অক্ষরের পাসওয়ার্ড দিন");
    return undefined;
  }
  if (typeof value !== "string" || value.length < 10 || value.length > 256) throw new ApiError(422, "VALIDATION_ERROR", "পাসওয়ার্ড ১০–২৫৬ অক্ষরের হতে হবে");
  return hashPassword(value);
}
export async function listUsers(actor: Actor, options?: ListOptions) {
  authorize(actor, "owner");
  const p = page(options);
  const t = searchTerms(p.q), active = activeTerm(p.q), role = labelTerm(p.q, { "মালিক": "owner", "ম্যানেজার": "manager", "রিসেপশন": "reception", "মাস্টার": "master", "কারিগর": "worker" });
  const filter = p.q ? or(ilike(users.name, "%" + t.raw + "%"), ilike(users.phone, "%" + t.normalized + "%"), t.digits ? ilike(users.phone, "%" + t.digits + "%") : undefined, ilike(users.email, "%" + t.raw + "%"), role ? eq(users.role, role) : undefined, active !== undefined ? eq(users.isActive, active) : undefined) : undefined;
  const [rows, count] = await Promise.all([db.select(safeFields).from(users).where(filter).orderBy(asc(users.name)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(users).where(filter)]);
  return { rows, total: count[0].n, page: p.page, limit: p.limit };
}
export async function getUser(actor: Actor, id: string) {
  authorize(actor, "owner");
  return present((await db.select(safeFields).from(users).where(eq(users.id, uuid(id))).limit(1))[0], "ব্যবহারকারী");
}
export async function createUser(actor: Actor, input: Input) {
  authorize(actor, "owner");
  const hash = passwordHash(input.password, true)!;
  const role = choice(input.role, ROLES, "ভূমিকা", "reception");
  const id = await db.transaction(async (tx) => {
    const person = input.personId ? await resolvePerson(tx, {}, uuid(input.personId)) : await resolvePerson(tx, personFields(input));
    if (!person.phone && !person.email) throw new ApiError(422, "VALIDATION_ERROR", "লগইনের জন্য ফোন বা ইমেইল দিন");
    const [existing] = await tx.select({ id: userAccounts.id }).from(userAccounts).where(eq(userAccounts.personId, person.id)).limit(1);
    if (existing) throw new ApiError(409, "DUPLICATE", "এই ব্যক্তির লগইন অ্যাকাউন্ট আছে");
    if (role === "worker") {
      const [worker] = await tx.select({ id: workerProfiles.id }).from(workerProfiles).where(and(eq(workerProfiles.personId, person.id), eq(workerProfiles.isActive, true))).limit(1);
      if (!worker) throw new ApiError(422, "WORKER_NOT_LINKED", "প্রথমে এই ব্যক্তির কারিগর প্রোফাইল তৈরি করুন");
    }
    const [created] = await tx.insert(userAccounts).values({ personId: person.id, role, passwordHash: hash, isActive: bool(input.isActive) }).returning({ id: userAccounts.id });
    await recordAudit(tx, { actorId: actor.userId, action: "create", entity: "user", entityId: created.id, details: { role, personId: person.id } });
    return created.id;
  });
  return getUser(actor, id);
}
export async function updateUser(actor: Actor, id: string, input: Input) {
  authorize(actor, "owner");
  const userId = uuid(id);
  const hash = passwordHash(input.password);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('active-owner-accounts'))`);
    const current = present((await tx.select().from(userAccounts).where(eq(userAccounts.id, userId)).for("update"))[0], "ব্যবহারকারী");
    if (input.personId !== undefined && input.personId !== current.personId) throw new ApiError(422, "IDENTITY_IMMUTABLE", "ব্যক্তির সংযোগ বদলানো যাবে না");
    const role = choice(input.role, ROLES, "ভূমিকা", current.role);
    const isActive = bool(input.isActive, current.isActive);
    if (current.role === "owner" && current.isActive && (role !== "owner" || !isActive)) {
      const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(userAccounts).where(and(eq(userAccounts.role, "owner"), eq(userAccounts.isActive, true)));
      if (count.n <= 1) throw new ApiError(409, "LAST_OWNER", "শেষ সক্রিয় মালিককে নিষ্ক্রিয় করা যাবে না");
    }
    const person = await resolvePerson(tx, personFields(input), current.personId);
    if (!person.phone && !person.email) throw new ApiError(422, "VALIDATION_ERROR", "লগইনের জন্য ফোন বা ইমেইল প্রয়োজন");
    if (role === "worker" && isActive) {
      const [worker] = await tx.select({ id: workerProfiles.id }).from(workerProfiles).where(and(eq(workerProfiles.personId, current.personId), eq(workerProfiles.isActive, true))).limit(1);
      if (!worker) throw new ApiError(422, "WORKER_NOT_LINKED", "সক্রিয় কারিগর প্রোফাইল প্রয়োজন");
    }
    await tx.update(userAccounts).set({ role, isActive, ...(hash ? { passwordHash: hash } : {}), updatedAt: new Date() }).where(eq(userAccounts.id, userId));
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "user", entityId: userId, details: { fields: changedFields(input), passwordChanged: Boolean(hash) } });
  });
  return getUser(actor, userId);
}
export async function archiveUser(actor: Actor, id: string) {
  return updateUser(actor, id, { isActive: false });
}
