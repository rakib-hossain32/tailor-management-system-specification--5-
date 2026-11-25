import "server-only";
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { fabricRecords, fabrics, stockMovements, users } from "@/db/schema";
import { ApiError } from "@/lib/api-route";
import { text } from "@/lib/api-input";
import { recordAudit } from "@/server/audit";
import type { Transaction } from "@/server/repositories/people";
import { amount, authorize, bool, changedFields, choice, page, present, quantity, required, searchTerms, activeTerm, uuid, type Actor, type Input, type ListOptions } from "./ops-common";

function fields(input: Input, current?: typeof fabricRecords.$inferSelect) {
  const code = required(input.code ?? current?.code, "কাপড়ের কোড", 50).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(code)) throw new ApiError(422, "VALIDATION_ERROR", "কোডে ইংরেজি অক্ষর, সংখ্যা, হাইফেন ব্যবহার করুন");
  return { code, name: required(input.name ?? current?.name, "কাপড়ের নাম"), type: required(input.type ?? current?.type ?? "cotton", "কাপড়ের ধরন", 50), color: input.color === undefined ? current?.color ?? null : text(input.color, "রং", 100) || null,
    unit: choice(input.unit, ["yard", "meter"], "একক", current?.unit ?? "yard"), costPrice: amount(input.costPrice ?? Number(current?.costPrice ?? 0), "ক্রয়মূল্য"), sellPrice: amount(input.sellPrice ?? Number(current?.sellPrice ?? 0), "বিক্রয়মূল্য"),
    reorderLevel: quantity(input.reorderLevel ?? Number(current?.reorderLevel ?? 0), "রিঅর্ডার সীমা").toFixed(2), supplier: input.supplier === undefined ? current?.supplier ?? null : text(input.supplier, "সরবরাহকারী", 150) || null, isActive: bool(input.isActive, current?.isActive ?? true) };
}
export async function listFabrics(actor: Actor, options?: ListOptions) {
  authorize(actor, "admin");
  const p = page(options), t = searchTerms(p.q), active = activeTerm(p.q);
  const filter = p.q ? or(ilike(fabrics.name, "%" + t.raw + "%"), ilike(fabrics.code, "%" + t.normalized + "%"), ilike(fabrics.type, "%" + t.raw + "%"), ilike(fabrics.color, "%" + t.raw + "%"), ilike(fabrics.supplier, "%" + t.raw + "%"), t.digits ? sql`${fabrics.sellPrice}::text ilike ${"%" + t.digits + "%"}` : undefined, t.digits ? sql`${fabrics.costPrice}::text ilike ${"%" + t.digits + "%"}` : undefined, active !== undefined ? eq(fabrics.isActive, active) : undefined) : undefined;
  const [rows, count] = await Promise.all([db.select().from(fabrics).where(filter).orderBy(asc(fabrics.name)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(fabrics).where(filter)]);
  return { rows, total: count[0].n, page: p.page, limit: p.limit };
}
export async function getFabric(actor: Actor, id: string) {
  authorize(actor, "admin");
  const item = present((await db.select().from(fabrics).where(eq(fabrics.id, uuid(id))).limit(1))[0], "কাপড়");
  const movements = await db.select({ movement: stockMovements, actorName: users.name }).from(stockMovements).leftJoin(users, eq(stockMovements.actorId, users.id)).where(eq(stockMovements.fabricId, id)).orderBy(desc(stockMovements.createdAt)).limit(50);
  return { ...item, movements: movements.map((row) => ({ ...row.movement, actorName: row.actorName })) };
}
export async function appendStockMovement(tx: Transaction, actor: Actor, id: string, delta: number, reason: string) {
  const fabricId = uuid(id), change = quantity(delta, "স্টকের পরিবর্তন", true);
  if (!change) throw new ApiError(422, "VALIDATION_ERROR", "স্টকের পরিবর্তন শূন্য হতে পারে না");
  const fabric = present((await tx.select().from(fabricRecords).where(eq(fabricRecords.id, fabricId)).for("update"))[0], "কাপড়");
  if (!fabric.isActive) throw new ApiError(409, "ARCHIVED", "নিষ্ক্রিয় কাপড়ের স্টক পরিবর্তন করা যাবে না");
  const [balance] = await tx.select({ qty: sql<string>`coalesce(sum(${stockMovements.qtyDelta}),0)` }).from(stockMovements).where(eq(stockMovements.fabricId, fabricId));
  const next = Math.round((Number(balance.qty) + change) * 100) / 100;
  if (next < 0) throw new ApiError(409, "INSUFFICIENT_STOCK", "স্টকের চেয়ে বেশি কাপড় ব্যবহার করা যাবে না");
  const [movement] = await tx.insert(stockMovements).values({ fabricId, qtyDelta: change.toFixed(2), reason: required(reason, "স্টক পরিবর্তনের কারণ", 1000), actorId: actor.userId }).returning({ id: stockMovements.id });
  await recordAudit(tx, { actorId: actor.userId, action: "stock_movement", entity: "fabric", entityId: fabricId, details: { movementId: movement.id, qtyDelta: change } });
  return { stockQty: next.toFixed(2), movementId: movement.id };
}
export async function adjustStock(actor: Actor, id: string, delta: number, reason: string) {
  authorize(actor, "admin");
  return db.transaction((tx) => appendStockMovement(tx, actor, id, delta, reason));
}
export async function createFabric(actor: Actor, input: Input) {
  authorize(actor, "management");
  const values = fields(input), opening = quantity(input.openingStock ?? 0, "প্রারম্ভিক স্টক");
  const id = await db.transaction(async (tx) => {
    const [created] = await tx.insert(fabricRecords).values(values).returning({ id: fabricRecords.id });
    if (opening) await appendStockMovement(tx, actor, created.id, opening, text(input.reason, "কারণ", 1000) || "প্রারম্ভিক স্টক");
    await recordAudit(tx, { actorId: actor.userId, action: "create", entity: "fabric", entityId: created.id, details: { fields: changedFields(input) } });
    return created.id;
  });
  return getFabric(actor, id);
}
export async function updateFabric(actor: Actor, id: string, input: Input) {
  authorize(actor, "management");
  const fabricId = uuid(id);
  if ("stockQty" in input || "openingStock" in input) throw new ApiError(422, "MOVEMENT_REQUIRED", "স্টক যোগ বা বিয়োগের পরিবর্তন দিন");
  await db.transaction(async (tx) => {
    const current = present((await tx.select().from(fabricRecords).where(eq(fabricRecords.id, fabricId)).for("update"))[0], "কাপড়");
    const values = fields(input, current);
    if (values.unit !== current.unit) {
      const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(stockMovements).where(eq(stockMovements.fabricId, fabricId));
      if (count.n) throw new ApiError(409, "UNIT_IN_USE", "স্টক লেজার থাকা কাপড়ের একক বদলানো যাবে না");
    }
    await tx.update(fabricRecords).set({ ...values, updatedAt: new Date() }).where(eq(fabricRecords.id, fabricId));
    if (input.qtyDelta !== undefined && input.qtyDelta !== 0) await appendStockMovement(tx, actor, fabricId, quantity(input.qtyDelta, "স্টকের পরিবর্তন", true), required(input.reason, "কারণ", 1000));
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "fabric", entityId: fabricId, details: { fields: changedFields(input) } });
  });
  return getFabric(actor, fabricId);
}
export async function archiveFabric(actor: Actor, id: string) {
  return updateFabric(actor, id, { isActive: false });
}
