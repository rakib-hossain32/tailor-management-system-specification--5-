import "server-only";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { viewFields } from "@/server/repositories/views";
import { db } from "@/db";
import { people, userAccounts, workerProfiles, workers } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { ApiError } from "@/lib/api-route";
import { recordAudit } from "@/server/audit";
import { resolvePerson } from "@/server/repositories/people";
import { amount, authorize, bool, changedFields, choice, date, page, personFields, present, searchTerms, strings, uuid, type Actor, type Input, type ListOptions, STAGES } from "./ops-common";

export async function listWorkers(actor: Actor, options?: ListOptions) {
  authorize(actor, "management");
  const p = page(options);
  const t = searchTerms(p.q); const filter = p.q ? or(ilike(workers.name, "%" + t.raw + "%"), ilike(workers.phone, "%" + t.normalized + "%"), t.digits ? ilike(workers.phone, "%" + t.digits + "%") : undefined) : undefined;
  const [rows, count] = await Promise.all([db.select({ worker: viewFields(workers), email: people.email }).from(workers).innerJoin(people, eq(workers.personId, people.id)).where(filter).orderBy(asc(workers.name)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(workers).where(filter)]);
  return { rows: rows.map((row) => ({ ...row.worker, email: row.email })), total: count[0].n, page: p.page, limit: p.limit };
}
export async function getWorker(actor: Actor, id: string) {
  authorize(actor, "management");
  const row = present((await db.select({ worker: viewFields(workers), email: people.email }).from(workers).innerJoin(people, eq(workers.personId, people.id)).where(eq(workers.id, uuid(id))).limit(1))[0], "কারিগর");
  return { ...row.worker, email: row.email };
}
function fields(input: Input, current?: typeof workerProfiles.$inferSelect) {
  const payType = choice(input.payType, ["piece_rate", "salary"], "মজুরির ধরন", current?.payType ?? "piece_rate");
  const monthlySalary = payType === "salary" ? amount(input.monthlySalary ?? (current?.monthlySalary != null ? Number(current.monthlySalary) : undefined), "মাসিক বেতন") : null;
  if (payType === "salary" && Number(monthlySalary) <= 0) throw new ApiError(422, "VALIDATION_ERROR", "মাসিক বেতন দিন");
  return { role: choice(input.role, STAGES, "কারিগরের ধাপ", current?.role ?? "stitching"), payType, monthlySalary, skillTags: input.skillTags === undefined ? current?.skillTags ?? [] : strings(input.skillTags, "দক্ষতা"), isActive: bool(input.isActive, current?.isActive ?? true), joinedOn: input.joinedOn === undefined ? current?.joinedOn ?? null : date(input.joinedOn, "যোগদানের তারিখ", true) };
}
export async function createWorker(actor: Actor, input: Input) {
  authorize(actor, "management");
  const values = fields(input);
  const password = input.password;
  if (password !== undefined && password !== "") {
    authorize(actor, "owner");
    if (typeof password !== "string" || password.length < 10 || password.length > 256) throw new ApiError(422, "VALIDATION_ERROR", "পাসওয়ার্ড ১০–২৫৬ অক্ষরের হতে হবে");
  }
  const id = await db.transaction(async (tx) => {
    const person = input.personId ? await resolvePerson(tx, {}, uuid(input.personId)) : await resolvePerson(tx, personFields(input));
    const [duplicate] = await tx.select({ id: workerProfiles.id }).from(workerProfiles).where(eq(workerProfiles.personId, person.id)).limit(1);
    if (duplicate) throw new ApiError(409, "DUPLICATE", "এই ব্যক্তির কারিগর প্রোফাইল আছে");
    const [created] = await tx.insert(workerProfiles).values({ ...values, personId: person.id }).returning({ id: workerProfiles.id });
    if (password) {
      if (!person.phone && !person.email) throw new ApiError(422, "VALIDATION_ERROR", "লগইনের জন্য ফোন বা ইমেইল দিন");
      const [account] = await tx.select({ id: userAccounts.id }).from(userAccounts).where(eq(userAccounts.personId, person.id)).limit(1);
      if (account) throw new ApiError(409, "DUPLICATE", "এই ব্যক্তির লগইন অ্যাকাউন্ট আছে — সেটিংস থেকে ভূমিকা বদলান");
      await tx.insert(userAccounts).values({ personId: person.id, role: "worker", passwordHash: hashPassword(password as string), isActive: true });
    }
    await recordAudit(tx, { actorId: actor.userId, action: "create", entity: "worker", entityId: created.id, details: { personId: person.id, loginCreated: Boolean(password) } });
    return created.id;
  });
  return getWorker(actor, id);
}
export async function updateWorker(actor: Actor, id: string, input: Input) {
  authorize(actor, "management");
  const workerId = uuid(id);
  if (input.password) throw new ApiError(422, "ACCOUNT_REQUIRED", "পাসওয়ার্ড পরিবর্তন ব্যবহারকারী ব্যবস্থাপনা থেকে করুন");
  await db.transaction(async (tx) => {
    const current = present((await tx.select().from(workerProfiles).where(eq(workerProfiles.id, workerId)).for("update"))[0], "কারিগর");
    if (input.personId !== undefined && input.personId !== current.personId) throw new ApiError(422, "IDENTITY_IMMUTABLE", "ব্যক্তির সংযোগ বদলানো যাবে না");
    await resolvePerson(tx, personFields(input), current.personId);
    await tx.update(workerProfiles).set({ ...fields(input, current), updatedAt: new Date() }).where(eq(workerProfiles.id, workerId));
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "worker", entityId: workerId, details: { fields: changedFields(input) } });
  });
  return getWorker(actor, workerId);
}
export async function archiveWorker(actor: Actor, id: string) {
  return updateWorker(actor, id, { isActive: false });
}
