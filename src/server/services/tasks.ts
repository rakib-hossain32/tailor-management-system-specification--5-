import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { viewFields } from "@/server/repositories/views";
import { db } from "@/db";
import { garmentStageRates, orderEvents, orderItems, orderRecords, settings, taskRecords, tasks, workerProfiles, workers } from "@/db/schema";
import { ApiError } from "@/lib/api-route";
import { text } from "@/lib/api-input";
import { recordAudit } from "@/server/audit";
import { getCurrentStageRates } from "./garments";
import { amount, authorize, changedFields, choice, page, present, uuid, type Actor, type Input, type ListOptions, STAGES } from "./ops-common";
import type { Transaction } from "@/server/repositories/people";

async function workerFor(tx: Transaction, id: unknown, stage: string) {
  if (id === undefined || id === null || id === "" || id === "unassigned") return null;
  const worker = present((await tx.select().from(workerProfiles).where(eq(workerProfiles.id, uuid(id, "কারিগরের পরিচয়"))).limit(1))[0], "কারিগর");
  if (!worker.isActive || worker.role !== stage) throw new ApiError(422, "WORKER_STAGE", "এই ধাপের সক্রিয় কারিগর নির্বাচন করুন");
  return worker.id;
}
export async function listTasks(actor: Actor, options?: ListOptions) {
  authorize(actor, "staff");
  const p = page(options);
  const filter = actor.role === "worker" ? eq(tasks.workerId, actor.workerId ?? "") : undefined;
  const [rows, count] = await Promise.all([db.select().from(tasks).where(filter).orderBy(asc(tasks.assignedAt)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(filter)]);
  return { rows, total: count[0].n, page: p.page, limit: p.limit };
}
export async function getTask(actor: Actor, id: string) {
  authorize(actor, "staff");
  const task = present((await db.select().from(tasks).where(and(eq(tasks.id, uuid(id)), actor.role === "worker" ? eq(tasks.workerId, actor.workerId ?? "") : undefined)).limit(1))[0], "কাজ");
  return task;
}
export async function createTask(actor: Actor, input: Input) {
  authorize(actor, "admin");
  const itemId = uuid(input.orderItemId, "অর্ডার আইটেম"), stage = choice(input.stage, STAGES, "ধাপ");
  const id = await db.transaction(async (tx) => {
    const item = present((await tx.select().from(orderItems).where(eq(orderItems.id, itemId)).limit(1))[0], "অর্ডার আইটেম");
    const order = present((await tx.select().from(orderRecords).where(eq(orderRecords.id, item.orderId)).for("update"))[0], "অর্ডার");
    if (["cancelled", "delivered"].includes(order.status)) throw new ApiError(409, "ORDER_CLOSED", "এই অর্ডারে কাজ যোগ করা যাবে না");
    const [existing] = await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.orderItemId, itemId), eq(tasks.stage, stage), ne(tasks.status, "cancelled"))).limit(1);
    if (existing) throw new ApiError(409, "DUPLICATE", "এই আইটেমের ধাপের কাজ ইতিমধ্যে আছে");
    const rates = await getCurrentStageRates(tx, item.garmentTypeId), workerId = await workerFor(tx, input.workerId, stage);
    if (input.pieceRateOverride !== undefined) authorize(actor, "management");
    const [created] = await tx.insert(taskRecords).values({ orderItemId: itemId, rateVersionId: rates[stage as typeof STAGES[number]].id, workerId, pieceRateOverride: input.pieceRateOverride == null ? null : amount(input.pieceRateOverride, "সম্মত মজুরি") }).returning({ id: taskRecords.id });
    await recordAudit(tx, { actorId: actor.userId, action: "create", entity: "task", entityId: created.id, details: { orderItemId: itemId, rateVersionId: rates[stage as typeof STAGES[number]].id, workerId } });
    return created.id;
  });
  return getTask(actor, id);
}
async function advanceStage(tx: Transaction, actor: Actor, orderId: string, initial: string) {
  const nextOf: Record<string, string> = { cutting: "stitching", stitching: "finishing", finishing: "trial_ready" };
  const [itemCount] = await tx.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(eq(orderItems.orderId, orderId));
  let current = initial;
  while (nextOf[current]) {
    const [status] = await tx.select({ items: sql<number>`count(distinct ${tasks.orderItemId})::int`, open: sql<number>`count(*) filter (where ${tasks.status} <> 'qc_passed')::int` }).from(tasks).innerJoin(orderItems, eq(tasks.orderItemId, orderItems.id)).where(and(eq(orderItems.orderId, orderId), eq(tasks.stage, current), ne(tasks.status, "cancelled")));
    if (!itemCount.n || status.items !== itemCount.n || status.open > 0) break;
    const next = nextOf[current];
    await tx.update(orderRecords).set({ status: next, updatedAt: new Date() }).where(eq(orderRecords.id, orderId));
    await tx.update(orderItems).set({ status: next, updatedAt: new Date() }).where(eq(orderItems.orderId, orderId));
    await tx.insert(orderEvents).values({ orderId, fromStatus: current, toStatus: next, note: "এই ধাপের সব আইটেম QC পাস", actorId: actor.userId });
    current = next;
  }
  return current;
}
export async function moveTask(actor: Actor, id: string, input: Input) {
  authorize(actor, "staff");
  const taskId = uuid(id), action = requiredAction(input.action);
  if (actor.role === "worker" && !["start", "done"].includes(action)) throw new ApiError(403, "FORBIDDEN", "কারিগর শুধু নিজের কাজ শুরু বা শেষ করতে পারেন");
  if (["qc", "rework"].includes(action) && !["owner", "manager", "master"].includes(actor.role)) throw new ApiError(403, "FORBIDDEN", "QC যাচাইয়ের অনুমতি নেই");
  const [link] = await db.select({ orderId: orderItems.orderId }).from(taskRecords).innerJoin(orderItems, eq(taskRecords.orderItemId, orderItems.id)).where(eq(taskRecords.id, taskId)).limit(1);
  present(link, "কাজ");
  await db.transaction(async (tx) => {
    const order = present((await tx.select().from(orderRecords).where(eq(orderRecords.id, link.orderId)).for("update"))[0], "অর্ডার");
    const task = present((await tx.select().from(taskRecords).where(eq(taskRecords.id, taskId)).for("update"))[0], "কাজ");
    if (actor.role === "worker" && task.workerId !== actor.workerId) throw new ApiError(404, "NOT_FOUND", "কাজ পাওয়া যায়নি");
    if (["cancelled", "delivered", "on_hold"].includes(order.status)) throw new ApiError(409, "ORDER_CLOSED", "এই অর্ডারের কাজ এখন পরিবর্তন করা যাবে না");
    const rate = present((await tx.select().from(garmentStageRates).where(eq(garmentStageRates.id, task.rateVersionId)).limit(1))[0], "ধাপের মজুরি");
    const stage = rate.stage, now = new Date();
    if (action === "assign" || action === "unassign") {
      if (!["assigned", "rework"].includes(task.status)) throw new ApiError(409, "STATE_ERROR", "শুরু বা সম্পন্ন কাজ আগে রিওয়ার্কে ফেরান");
      await tx.update(taskRecords).set({ workerId: action === "unassign" ? null : await workerFor(tx, input.workerId, stage), assignedAt: now, updatedAt: now }).where(eq(taskRecords.id, taskId));
    } else if (action === "start") {
      if (!["assigned", "rework"].includes(task.status)) throw new ApiError(409, "STATE_ERROR", "এই কাজ ইতিমধ্যে শুরু বা সম্পন্ন হয়েছে");
      if (!task.workerId) throw new ApiError(409, "UNASSIGNED", "আগে কারিগরকে কাজ বণ্টন করুন");
      const previous = STAGES[STAGES.indexOf(stage as typeof STAGES[number]) - 1];
      if (previous) {
        const prior = await tx.select({ status: tasks.status }).from(tasks).where(and(eq(tasks.orderItemId, task.orderItemId), eq(tasks.stage, previous), ne(tasks.status, "cancelled")));
        if (!prior.length || prior.some((row) => row.status !== "qc_passed")) throw new ApiError(409, "PREVIOUS_STAGE", "আগের ধাপের QC শেষ হলে এই কাজ শুরু করুন");
      }
      await tx.update(taskRecords).set({ status: "in_progress", startedAt: now, completedAt: null, updatedAt: now }).where(eq(taskRecords.id, taskId));
      if (order.status === "confirmed" && stage === "cutting") {
        await tx.update(orderRecords).set({ status: "cutting", updatedAt: now }).where(eq(orderRecords.id, order.id));
        await tx.update(orderItems).set({ status: "cutting", updatedAt: now }).where(eq(orderItems.orderId, order.id));
        await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: "confirmed", toStatus: "cutting", note: "কাটিং কাজ শুরু হয়েছে", actorId: actor.userId });
      }
    } else if (action === "done") {
      if (task.status !== "in_progress") throw new ApiError(409, "STATE_ERROR", "চলমান কাজই শেষ করা যায়");
      await tx.update(taskRecords).set({ status: "done", completedAt: now, updatedAt: now }).where(eq(taskRecords.id, taskId));
    } else if (action === "qc") {
      if (task.status !== "done") throw new ApiError(409, "STATE_ERROR", "কাজ শেষ হলে QC পাস করা যায়");
      await tx.update(taskRecords).set({ status: "qc_passed", qcNote: text(input.note, "QC নোট", 2000) || null, updatedAt: now }).where(eq(taskRecords.id, taskId));
      await advanceStage(tx, actor, order.id, order.status);
    } else if (action === "rework") {
      if (!["done", "qc_passed"].includes(task.status)) throw new ApiError(409, "STATE_ERROR", "সম্পন্ন কাজই রিওয়ার্কে ফেরানো যায়");
      await tx.update(taskRecords).set({ status: "rework", completedAt: null, qcNote: text(input.note, "রিওয়ার্ক নোট", 2000) || null, updatedAt: now }).where(eq(taskRecords.id, taskId));
      if (order.status !== stage) {
        await tx.update(orderRecords).set({ status: stage, updatedAt: now }).where(eq(orderRecords.id, order.id));
        await tx.update(orderItems).set({ status: stage, updatedAt: now }).where(eq(orderItems.orderId, order.id));
        await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: order.status, toStatus: stage, note: "QC রিওয়ার্ক", actorId: actor.userId });
      }
    } else if (action === "cancel") {
      authorize(actor, "management");
      if (!["assigned", "rework"].includes(task.status)) throw new ApiError(409, "STATE_ERROR", "শুধু শুরু না হওয়া কাজ বাতিল করা যাবে");
      await tx.update(taskRecords).set({ status: "cancelled", qcNote: text(input.note, "কারণ", 2000) || null, updatedAt: now }).where(eq(taskRecords.id, taskId));
    }
    await recordAudit(tx, { actorId: actor.userId, action, entity: "task", entityId: taskId, details: { oldStatus: task.status, fields: changedFields(input) } });
  });
  return getTask(actor, taskId);
}
function requiredAction(value: unknown) {
  return choice(value, ["assign", "unassign", "start", "done", "qc", "rework", "cancel"], "কাজের পরিবর্তন");
}
export async function updateTask(actor: Actor, id: string, input: Input) {
  if (input.action) return moveTask(actor, id, input);
  authorize(actor, "management");
  const taskId = uuid(id);
  if (!("pieceRateOverride" in input)) throw new ApiError(422, "VALIDATION_ERROR", "কাজের পরিবর্তন নির্বাচন করুন");
  await db.transaction(async (tx) => {
    const task = present((await tx.select().from(taskRecords).where(eq(taskRecords.id, taskId)).for("update"))[0], "কাজ");
    if (!["assigned", "rework"].includes(task.status)) throw new ApiError(409, "STATE_ERROR", "শুরু না হওয়া কাজের মজুরিই বদলানো যায়");
    await tx.update(taskRecords).set({ pieceRateOverride: input.pieceRateOverride == null ? null : amount(input.pieceRateOverride, "সম্মত মজুরি"), updatedAt: new Date() }).where(eq(taskRecords.id, taskId));
    await recordAudit(tx, { actorId: actor.userId, action: "agreed_rate", entity: "task", entityId: taskId, details: { fields: ["pieceRateOverride"] } });
  });
  return getTask(actor, taskId);
}
export async function cancelTask(actor: Actor, id: string) {
  return moveTask(actor, id, { action: "cancel" });
}
async function ensureTasks(tx: Transaction) {
  const orders = await tx.select().from(orderRecords).where(inArray(orderRecords.status, ["confirmed", "cutting", "stitching", "finishing"])).orderBy(asc(orderRecords.id)).for("update");
  for (const order of orders) {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      const existing = await tx.select({ stage: tasks.stage }).from(tasks).where(and(eq(tasks.orderItemId, item.id), ne(tasks.status, "cancelled")));
      const missing = STAGES.filter((stage) => !existing.some((task) => task.stage === stage));
      if (!missing.length) continue;
      const rates = await getCurrentStageRates(tx, item.garmentTypeId);
      for (const stage of missing) await tx.insert(taskRecords).values({ orderItemId: item.id, rateVersionId: rates[stage].id });
    }
  }
}
export async function autoDistributeTasks(actor: Actor, taskId?: string) {
  authorize(actor, "admin");
  if (taskId) uuid(taskId);
  return db.transaction(async (tx) => {
    await ensureTasks(tx);
    const active = await tx.select({ id: workers.id, role: workers.role }).from(workers).where(eq(workers.isActive, true)).orderBy(asc(workers.name));
    const assigned = await tx.select({ id: tasks.workerId }).from(tasks).where(inArray(tasks.status, ["assigned", "in_progress", "rework"]));
    const load = new Map(active.map((worker) => [worker.id, assigned.filter((task) => task.id === worker.id).length]));
    const unassigned = await tx.select({ task: viewFields(tasks), orderId: orderItems.orderId }).from(tasks).innerJoin(orderItems, eq(tasks.orderItemId, orderItems.id)).innerJoin(orderRecords, eq(orderItems.orderId, orderRecords.id)).where(and(sql`${tasks.workerId} is null`, inArray(tasks.status, ["assigned", "rework"]), inArray(orderRecords.status, ["confirmed", "cutting", "stitching", "finishing"]), taskId ? eq(tasks.id, taskId) : undefined)).orderBy(asc(tasks.assignedAt));
    let count = 0;
    for (const row of unassigned) {
      const candidates = active.filter((worker) => worker.role === row.task.stage).sort((a, b) => load.get(a.id)! - load.get(b.id)!);
      const chosen = candidates[0];
      if (!chosen) continue;
      await tx.update(taskRecords).set({ workerId: chosen.id, assignedAt: new Date(), updatedAt: new Date() }).where(eq(taskRecords.id, row.task.id));
      load.set(chosen.id, load.get(chosen.id)! + 1); count += 1;
      await recordAudit(tx, { actorId: actor.userId, action: "auto_assign", entity: "task", entityId: row.task.id, details: { workerId: chosen.id } });
    }
    return { assigned: count };
  });
}
export async function updateAssignmentPolicy(actor: Actor, mode: unknown) {
  authorize(actor, "management");
  const value = choice(mode, ["auto", "manual", "unassigned"], "বণ্টন নীতি");
  await db.transaction(async (tx) => {
    await tx.insert(settings).values({ key: "assignment_policy", value: { mode: value } }).onConflictDoUpdate({ target: settings.key, set: { value: { mode: value }, updatedAt: new Date() } });
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "setting", entityId: "assignment_policy", details: { mode: value } });
  });
  return { mode: value };
}
