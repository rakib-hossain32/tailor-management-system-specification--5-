import "server-only";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenseRecords } from "@/db/schema";
import { ApiError } from "@/lib/api-route";
import { text } from "@/lib/api-input";
import { recordAudit } from "@/server/audit";
import { amount, authorize, bool, changedFields, choice, date, page, present, required, uuid, type Actor, type Input, type ListOptions } from "./ops-common";

function fields(input: Input, current?: typeof expenseRecords.$inferSelect) {
  const value = amount(input.amount ?? (current ? Number(current.amount) : undefined), "খরচ");
  if (Number(value) <= 0) throw new ApiError(422, "VALIDATION_ERROR", "খরচের পরিমাণ শূন্যের বেশি দিন");
  return { category: required(input.category ?? current?.category, "খরচের ক্যাটাগরি", 100), amount: value, date: date(input.date ?? current?.date, "তারিখ")!,
    method: choice(input.method, ["cash", "bkash", "nagad", "rocket", "card", "bank"], "পেমেন্ট মাধ্যম", current?.method ?? "cash"), note: input.note === undefined ? current?.note ?? null : text(input.note, "নোট", 2000) || null, isActive: bool(input.isActive, current?.isActive ?? true) };
}
export async function listExpenses(actor: Actor, options?: ListOptions) {
  authorize(actor, "management");
  const p = page(options), filter = p.q ? or(ilike(expenseRecords.category, "%" + p.q + "%"), ilike(expenseRecords.note, "%" + p.q + "%")) : undefined;
  const [rows, count] = await Promise.all([db.select().from(expenseRecords).where(filter).orderBy(desc(expenseRecords.date), desc(expenseRecords.createdAt)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(expenseRecords).where(filter)]);
  return { rows, total: count[0].n, page: p.page, limit: p.limit };
}
export async function getExpense(actor: Actor, id: string) {
  authorize(actor, "management");
  return present((await db.select().from(expenseRecords).where(eq(expenseRecords.id, uuid(id))).limit(1))[0], "খরচ");
}
export async function createExpense(actor: Actor, input: Input) {
  authorize(actor, "management");
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(expenseRecords).values({ ...fields(input), actorId: actor.userId }).returning();
    await recordAudit(tx, { actorId: actor.userId, action: "create", entity: "expense", entityId: created.id, details: { fields: changedFields(input) } });
    return created;
  });
}
export async function updateExpense(actor: Actor, id: string, input: Input) {
  authorize(actor, "management");
  const expenseId = uuid(id);
  return db.transaction(async (tx) => {
    const current = present((await tx.select().from(expenseRecords).where(eq(expenseRecords.id, expenseId)).for("update"))[0], "খরচ");
    const [updated] = await tx.update(expenseRecords).set({ ...fields(input, current), updatedAt: new Date() }).where(eq(expenseRecords.id, expenseId)).returning();
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "expense", entityId: expenseId, details: { fields: changedFields(input), oldAmount: current.amount, newAmount: updated.amount } });
    return updated;
  });
}
export async function archiveExpense(actor: Actor, id: string) {
  return updateExpense(actor, id, { isActive: false });
}
