"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  expenses,
  fabrics,
  settings,
  tasks,
  orders,
  orderItems,
  orderStatusHistory,
  workers,
} from "@/db/schema";
import { isValidBdPhone, normalizePhone } from "@/lib/format";
import { AuthError, requireAdmin, requireOwnerOrManager, requireStaff } from "@/lib/access";
import { ApiError } from "@/lib/api-route";
import { appointmentSlot } from "@/lib/appointments";

/** Every action ends by redirecting back with an ok/error banner. */
function flash(path: string, key: "ok" | "error", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${key}=${encodeURIComponent(message)}`);
}

function returnPath(formData: FormData, fallback: string): string {
  const raw = String(formData.get("return_path") ?? "").trim();
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

/* ------------------------------------------------------------------ expenses */

export async function addExpense(formData: FormData): Promise<void> {
  await requireOwnerOrManager();
  const path = returnPath(formData, "/admin/expenses");
  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const date = String(formData.get("date") ?? "").slice(0, 10);
  const method = String(formData.get("method") ?? "cash");
  const note = String(formData.get("note") ?? "").trim();

  if (!category || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    flash(path, "error", "ক্যাটাগরি, সঠিক টাকা ও তারিখ দিন");
  }

  await db.insert(expenses).values({
    category: category.slice(0, 60),
    amount: amount.toFixed(2),
    date,
    method,
    note: note || null,
    enteredBy: "অ্যাডমিন",
  });

  revalidatePath("/admin/expenses");
  revalidatePath("/admin/payments");
  flash(path, "ok", `খরচ সেভ হয়েছে — ৳${amount.toLocaleString("en-US")}`);
}

/* ------------------------------------------------------------ stock movement */

export async function addStockMovement(formData: FormData): Promise<void> {
  await requireAdmin();
  const path = returnPath(formData, "/admin/inventory");
  const fabricId = String(formData.get("fabric_id") ?? "");
  const qty = Number(formData.get("qty"));
  const note = String(formData.get("note") ?? "").trim();

  if (!fabricId || !Number.isFinite(qty) || qty === 0) {
    flash(path, "error", "কাপড় ও পরিমাণ (ঋণাত্মক হলে ব্যবহার) দিন");
  }

  const rows = await db.select().from(fabrics).where(eq(fabrics.id, fabricId)).limit(1);
  if (rows.length === 0) flash(path, "error", "কাপড় পাওয়া যায়নি");

  const current = Number(rows[0].stockQty);
  const next = Math.round((current + qty) * 100) / 100;

  await db
    .update(fabrics)
    .set({ stockQty: next.toFixed(2), updatedAt: new Date() })
    .where(eq(fabrics.id, fabricId));

  revalidatePath("/admin/inventory");
  flash(
    path,
    next < 0 ? "error" : "ok",
    next < 0
      ? `সেভ হয়েছে, কিন্তু স্টক ঋণাত্মক (${next}) — মালিকের নজরে আনুন${note ? ` · ${note}` : ""}`
      : `স্টক আপডেট হয়েছে: ${current} → ${next}${note ? ` · ${note}` : ""}`,
  );
}

/* --------------------------------------------------------------- shop info */

export async function updateShopInfo(formData: FormData): Promise<void> {
  await requireOwnerOrManager();
  const path = returnPath(formData, "/admin/settings");
  const value = {
    name_bn: String(formData.get("name_bn") ?? "").trim(),
    name_en: String(formData.get("name_en") ?? "").trim(),
    tagline: String(formData.get("tagline") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    hours: String(formData.get("hours") ?? "").trim(),
    invoice_footer: String(formData.get("invoice_footer") ?? "").trim(),
    currency: "BDT",
  };

  if (value.name_bn.length < 2) flash(path, "error", "দোকানের নাম দিন");

  await db
    .insert(settings)
    .values({ key: "shop", value: value as Record<string, string>, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as Record<string, string>, updatedAt: new Date() },
    });

  revalidatePath("/admin/settings");
  flash(path, "ok", "দোকানের তথ্য সেভ হয়েছে");
}

/* ------------------------------------------------------------- appointments */

export async function createAppointment(formData: FormData): Promise<void> {
  await requireAdmin();
  const path = returnPath(formData, "/admin/appointments");
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const purpose = String(formData.get("purpose") ?? "নতুন মাপ").trim();
  const date = String(formData.get("date") ?? "").slice(0, 10);
  const time = String(formData.get("time") ?? "").slice(0, 5);
  const notes = String(formData.get("notes") ?? "").trim();

  if (name.length < 2) flash(path, "error", "নাম দিন");
  if (!isValidBdPhone(phone)) flash(path, "error", "সঠিক ফোন নম্বর দিন (01XXXXXXXXX)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    flash(path, "error", "তারিখ ও সময় দিন");
  }

  try {
    const { start, end } = appointmentSlot(date, time);
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"appointment-slot:" + start.toISOString()}))`);
      appointmentSlot(date, time);
      const [clash] = await tx.select({ id: appointments.id }).from(appointments)
        .where(and(lt(appointments.startsAt, end), gt(appointments.endsAt, start), ne(appointments.status, "cancelled"), ne(appointments.status, "no_show"))).limit(1);
      if (clash) throw new ApiError(409, "SLOT_TAKEN", "এই সময়টি ইতিমধ্যে বুক করা হয়েছে");
      await tx.insert(appointments).values({
        name, phone, purpose: purpose.slice(0, 60), startsAt: start, endsAt: end,
        status: "confirmed", notes: notes || null,
      });
    });
  } catch (error) {
    if (error instanceof ApiError) flash(path, "error", error.message);
    throw error;
  }

  revalidatePath("/admin/appointments");
  flash(path, "ok", `${name} — ${date} ${time} স্লট যোগ হয়েছে`);
}

export async function setAppointmentStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const path = returnPath(formData, "/admin/appointments");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["booked", "confirmed", "done", "no_show", "cancelled"];
  if (!id || !allowed.includes(status)) flash(path, "error", "ভুল অনুরোধ");

  await db.update(appointments).set({ status, updatedAt: new Date() }).where(eq(appointments.id, id));
  revalidatePath("/admin/appointments");
  flash(path, "ok", "স্ট্যাটাস আপডেট হয়েছে");
}

/* ---------------------------------------------------------------- task moves */

const DEFAULT_STAGE_RATES: Record<string, string> = {
  cutting: "65.00",
  stitching: "200.00",
  finishing: "75.00",
};

/**
 * Ensures every active order item has its 3 stage tasks (cutting, stitching, finishing)
 * created in the `tasks` table so they can be assigned or left unassigned.
 */
async function ensureTasksForActiveItems() {
  const activeItems = await db
    .select({ itemId: orderItems.id, orderStatus: orders.status })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(inArray(orders.status, ["confirmed", "cutting", "stitching", "finishing"]));

  if (activeItems.length === 0) return;

  const existingTasks = await db
    .select({ orderItemId: tasks.orderItemId, stage: tasks.stage })
    .from(tasks)
    .where(
      inArray(
        tasks.orderItemId,
        activeItems.map((a) => a.itemId),
      ),
    );

  const hasSet = new Set(existingTasks.map((t) => `${t.orderItemId}:${t.stage}`));
  const toInsert: {
    orderItemId: string;
    stage: string;
    workerId: string | null;
    status: string;
    pieceRate: string;
  }[] = [];

  for (const it of activeItems) {
    for (const stage of ["cutting", "stitching", "finishing"]) {
      if (!hasSet.has(`${it.itemId}:${stage}`)) {
        toInsert.push({
          orderItemId: it.itemId,
          stage,
          workerId: null,
          status: "assigned",
          pieceRate: DEFAULT_STAGE_RATES[stage] ?? "80.00",
        });
      }
    }
  }

  if (toInsert.length > 0) {
    await db.insert(tasks).values(toInsert);
  }
}

/**
 * Pick the active worker for `stage` with the lowest current open task count
 * (round-robin / least-loaded balancing).
 */
async function pickNextWorkerForStage(
  stage: string,
  loadMap: Map<string, number>,
  workersByRole: Map<string, { id: string; name: string }[]>,
): Promise<{ id: string; name: string } | null> {
  const roleKey = stage === "cutting" ? "cutting" : stage === "finishing" ? "finishing" : "stitching";
  const candidates = workersByRole.get(roleKey) ?? [];
  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestLoad = loadMap.get(best.id) ?? 0;
  for (const c of candidates) {
    const l = loadMap.get(c.id) ?? 0;
    if (l < bestLoad) {
      best = c;
      bestLoad = l;
    }
  }
  loadMap.set(best.id, bestLoad + 1);
  return best;
}

/**
 * Automatic one-by-one (round-robin / least-loaded) distribution of unassigned tasks.
 * Can distribute either ALL unassigned tasks or a single task / order item.
 */
export async function autoDistributeTasks(formData: FormData): Promise<void> {
  await requireAdmin();
  const path = returnPath(formData, "/admin");
  const targetTaskId = String(formData.get("task_id") ?? "").trim();

  await ensureTasksForActiveItems();

  const activeWorkers = await db
    .select({ id: workers.id, name: workers.name, role: workers.role })
    .from(workers)
    .where(eq(workers.isActive, true))
    .orderBy(asc(workers.name));

  if (activeWorkers.length === 0) {
    flash(path, "error", "কোনো সক্রিয় কারিগর পাওয়া যায়নি");
  }

  const openTaskRows = await db
    .select({ workerId: tasks.workerId })
    .from(tasks)
    .where(inArray(tasks.status, ["assigned", "in_progress", "rework"]));

  const loadMap = new Map<string, number>();
  for (const w of activeWorkers) loadMap.set(w.id, 0);
  for (const r of openTaskRows) {
    if (r.workerId && loadMap.has(r.workerId)) {
      loadMap.set(r.workerId, (loadMap.get(r.workerId) ?? 0) + 1);
    }
  }

  const workersByRole = new Map<string, { id: string; name: string }[]>();
  for (const w of activeWorkers) {
    const list = workersByRole.get(w.role) ?? [];
    list.push({ id: w.id, name: w.name });
    workersByRole.set(w.role, list);
  }

  const unassigned = targetTaskId
    ? await db.select().from(tasks).where(eq(tasks.id, targetTaskId))
    : await db
        .select()
        .from(tasks)
        .where(isNull(tasks.workerId))
        .orderBy(asc(tasks.assignedAt));

  if (unassigned.length === 0) {
    revalidatePath("/admin");
    revalidatePath("/admin/tasks");
    flash(path, "ok", "সব কাজ ইতিমধ্যে কারিগরদের মধ্যে বণ্টন করা আছে ✓");
  }

  let assignedCount = 0;
  for (const t of unassigned) {
    if (t.workerId || !["assigned", "rework"].includes(t.status)) continue;
    const chosen = await pickNextWorkerForStage(t.stage, loadMap, workersByRole);
    if (!chosen) continue;
    await db
      .update(tasks)
      .set({ workerId: chosen.id, status: "assigned", assignedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, t.id));
    assignedCount += 1;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/workers");
  flash(
    path,
    "ok",
    `স্বয়ংক্রিয়ভাবে একটার পর একটা মোট ${assignedCount}টি কাজ কারিগরদের মাঝে সুষমভাবে বণ্টন করা হয়েছে ✓`,
  );
}

/**
 * Toggle default assignment policy in settings ("auto" | "manual" | "unassigned").
 */
export async function updateAssignmentPolicy(formData: FormData): Promise<void> {
  await requireOwnerOrManager();
  const path = returnPath(formData, "/admin");
  const mode = String(formData.get("mode") ?? "auto");
  const validMode = ["auto", "manual", "unassigned"].includes(mode) ? mode : "auto";

  await db
    .insert(settings)
    .values({
      key: "assignment_policy",
      value: { mode: validMode },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { mode: validMode }, updatedAt: new Date() },
    });

  revalidatePath("/admin");
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/orders/new");
  const label =
    validMode === "auto"
      ? "স্বয়ংক্রিয় বণ্টন (একটার পর একটা)"
      : validMode === "manual"
        ? "ম্যানুয়াল বণ্টন (নিজে বেছে দেওয়া)"
        : "বণ্টন ছাড়া রাখা (পরে বণ্টন)";
  flash(path, "ok", `ডিফল্ট কাজ বণ্টন নীতি আপডেট হয়েছে: ${label}`);
}

export async function moveTask(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const path = returnPath(formData, session.role === "worker" ? "/worker" : "/admin/tasks");
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const workerId = String(formData.get("worker_id") ?? "");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) flash(path, "error", "সঠিক কাজ নির্বাচন করুন");
  if (session.role === "worker" && !["start", "done"].includes(action)) throw new AuthError(403, "কারিগর শুধু নিজের কাজ শুরু বা শেষ করতে পারেন");
  if (["qc", "rework"].includes(action) && !["owner", "manager", "master"].includes(session.role)) throw new AuthError(403, "QC যাচাইয়ের অনুমতি নেই");

  const [link] = await db.select({ orderId: orderItems.orderId }).from(tasks).innerJoin(orderItems, eq(tasks.orderItemId, orderItems.id)).where(eq(tasks.id, id)).limit(1);
  if (!link) flash(path, "error", "কাজ পাওয়া যায়নি");

  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, link.orderId)).for("update");
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, id)).for("update");
    if (!order || !task) return { error: "কাজ পাওয়া যায়নি" };
    if (session.role === "worker" && task.workerId !== session.workerId) throw new AuthError(403, "এই কাজ আপনার নয়");
    if (["cancelled", "delivered", "on_hold"].includes(order.status)) return { error: "এই অর্ডারের কাজ এখন পরিবর্তন করা যাবে না" };
    const now = new Date();

    if (action === "assign" || action === "unassign") {
      if (!["assigned", "rework"].includes(task.status)) return { error: "শুরু বা সম্পন্ন কাজ আগে রিওয়ার্কে ফেরান" };
      const assigned = action === "unassign" || !workerId || workerId === "unassigned" ? null : workerId;
      if (assigned) {
        if (!/^[a-f0-9-]{36}$/i.test(assigned)) return { error: "কারিগর নির্বাচন সঠিক নয়" };
        const [worker] = await tx.select().from(workers).where(eq(workers.id, assigned)).limit(1);
        if (!worker?.isActive || worker.role !== task.stage) return { error: "এই ধাপের সক্রিয় কারিগর নির্বাচন করুন" };
      }
      await tx.update(tasks).set({ workerId: assigned, assignedAt: now, updatedAt: now }).where(eq(tasks.id, id));
      return { message: assigned ? "কারিগরকে কাজ বণ্টন করা হয়েছে" : "কাজটি বণ্টন ছাড়া রাখা হয়েছে" };
    }
    if (action === "start") {
      if (!["assigned", "rework"].includes(task.status)) return { error: "এই কাজ ইতিমধ্যে শুরু বা সম্পন্ন হয়েছে" };
      const stageOrder = ["cutting", "stitching", "finishing"];
      const previous = stageOrder[stageOrder.indexOf(task.stage) - 1];
      if (previous) {
        const [prior] = await tx.select({ status: tasks.status }).from(tasks).where(sql`${tasks.orderItemId} = ${task.orderItemId} AND ${tasks.stage} = ${previous}`).limit(1);
        if (!prior || prior.status !== "qc_passed") return { error: "আগের ধাপের QC শেষ হলে এই কাজ শুরু করুন" };
      }
      await tx.update(tasks).set({ status: "in_progress", startedAt: now, completedAt: null, updatedAt: now }).where(eq(tasks.id, id));
      if (order.status === "confirmed" && task.stage === "cutting") {
        await tx.update(orders).set({ status: "cutting", updatedAt: now }).where(eq(orders.id, order.id));
        await tx.update(orderItems).set({ status: "cutting", updatedAt: now }).where(eq(orderItems.orderId, order.id));
        await tx.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: "confirmed", toStatus: "cutting", note: "কাটিং কাজ শুরু হয়েছে", changedBy: session.name });
      }
      return { message: "কাজ শুরু হয়েছে" };
    }
    if (action === "done") {
      if (task.status !== "in_progress") return { error: "চলমান কাজই শেষ করা যায়" };
      await tx.update(tasks).set({ status: "done", completedAt: now, updatedAt: now }).where(eq(tasks.id, id));
      return { message: "কাজ শেষ — এখন QC যাচাই বাকি" };
    }
    if (action === "rework") {
      if (!["done", "qc_passed"].includes(task.status)) return { error: "সম্পন্ন কাজই রিওয়ার্কে ফেরানো যায়" };
      await tx.update(tasks).set({ status: "rework", completedAt: null, qcNote: "রিওয়ার্ক নির্দেশিত", updatedAt: now }).where(eq(tasks.id, id));
      // Bring the order back to the stage being repaired before it can be completed.
      if (["cutting", "stitching", "finishing"].includes(task.stage) && order.status !== task.stage) {
        await tx.update(orders).set({ status: task.stage, updatedAt: now }).where(eq(orders.id, order.id));
        await tx.update(orderItems).set({ status: task.stage, updatedAt: now }).where(eq(orderItems.orderId, order.id));
        await tx.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: order.status, toStatus: task.stage, note: "QC রিওয়ার্ক", changedBy: session.name });
      }
      return { message: "রিওয়ার্কে ফেরানো হয়েছে" };
    }
    if (action === "qc") {
      if (task.status !== "done") return { error: "কাজ শেষ হলে QC পাস করা যায়" };
      await tx.update(tasks).set({ status: "qc_passed", qcNote: "যাচাই সম্পন্ন", updatedAt: now }).where(eq(tasks.id, id));
      const nextOf: Record<string, string> = { cutting: "stitching", stitching: "finishing", finishing: "trial_ready" };
      let current = order.status;
      let advanced = false;
      // Every item must complete the current stage; serialize on the order row.
      while (nextOf[current]) {
        const [remaining] = await tx.select({ total: sql<number>`count(*)::int`, open: sql<number>`count(*) filter (where ${tasks.status} <> 'qc_passed')::int` })
          .from(tasks).innerJoin(orderItems, eq(tasks.orderItemId, orderItems.id))
          .where(sql`${orderItems.orderId} = ${order.id} AND ${tasks.stage} = ${current}`);
        if (!remaining?.total || Number(remaining.open) > 0) break;
        const next = nextOf[current];
        await tx.update(orders).set({ status: next, updatedAt: now }).where(eq(orders.id, order.id));
        await tx.update(orderItems).set({ status: next, updatedAt: now }).where(eq(orderItems.orderId, order.id));
        await tx.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: current, toStatus: next, note: "এই ধাপের সব আইটেম QC পাস", changedBy: session.name });
        current = next;
        advanced = true;
      }
      return { message: advanced ? "QC পাস — অর্ডার পরবর্তী ধাপে চলেছে" : "QC পাস হয়েছে" };
    }
    return { error: "সঠিক কাজ নির্বাচন করুন" };
  });

  for (const target of ["/admin", "/admin/tasks", "/admin/workers", "/worker", "/worker/earnings", `/worker/tasks/${id}`, `/admin/orders/${link.orderId}`]) revalidatePath(target);
  if ("error" in result) flash(path, "error", result.error!);
  flash(path, "ok", result.message!);
}
