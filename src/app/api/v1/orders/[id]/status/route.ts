import { NextResponse } from "next/server";
import { db } from "@/db";
import { orderStatusHistory, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canTransition, statusMeta } from "@/lib/order-status";
import { adminRoute, ApiError, isUuid } from "@/lib/api-route";
import type { StaffSession } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/orders/:id/status
 * The ONLY legal way to move an order through the pipeline (PRD section 7).
 * Every transition is validated against the state machine and logged.
 */
async function changeStatus(req: Request, ctx: { params: Promise<{ id: string }> }, staff: StaffSession) {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "অর্ডার নম্বর সঠিক নয়");
  let body: { to?: string; note?: string; changed_by?: string; override_due?: boolean; override_reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "ভুল অনুরোধ" } },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body) || (body.to != null && typeof body.to !== "string")) {
    throw new ApiError(400, "VALIDATION_ERROR", "ভুল অনুরোধ");
  }
  if (body.override_due != null && typeof body.override_due !== "boolean") {
    throw new ApiError(400, "VALIDATION_ERROR", "ওভাররাইডের অনুমতি সঠিক নয়");
  }
  if ((body.note != null && (typeof body.note !== "string" || body.note.length > 2000)) || (body.override_reason != null && (typeof body.override_reason !== "string" || body.override_reason.length > 1000))) {
    throw new ApiError(400, "VALIDATION_ERROR", "নোট সঠিক নয়");
  }
  if (body.override_due && !["owner", "manager"].includes(staff.role)) {
    throw new ApiError(403, "FORBIDDEN", "বকেয়া সহ ডেলিভারি শুধু মালিক বা ম্যানেজার অনুমোদন করতে পারেন");
  }
  const to = (body.to ?? "").trim();
  if (!to) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "নতুন স্ট্যাটাস দিন" } },
      { status: 400 },
    );
  }

  const result = await db.transaction(async (tx) => {
    const rows = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    const order = rows[0];
    if (!order) return { status: 404, error: "অর্ডার পাওয়া যায়নি" } as const;

    if (order.status === to) {
      return { status: 409, error: "অর্ডার ইতিমধ্যে এই স্ট্যাটাসে আছে" } as const;
    }
    if (!canTransition(order.status, to)) {
      return {
        status: 422,
        error: `${statusMeta(order.status).labelBn} থেকে ${statusMeta(to).labelBn} যাওয়া যায় না`,
      } as const;
    }

    // PRD 7.3 — delivery requires zero due unless owner/manager overrides.
    if (to === "delivered" && Number(order.dueAmount) > 0 && !body.override_due) {
      return {
        status: 409,
        error: `বকেয়া ৳${order.dueAmount} পরিশোধ ছাড়া ডেলিভারি দেওয়া যায় না`,
        requires_override: true,
      } as const;
    }
    if (to === "delivered" && Number(order.dueAmount) > 0 && (!body.override_reason || body.override_reason.length < 4)) {
      return { status: 422, error: "ওভাররাইডের জন্য কারণ লিখুন" } as const;
    }

    const [updated] = await tx
      .update(orders)
      .set({
        status: to,
        updatedAt: new Date(),
        notes:
          to === "delivered" && Number(order.dueAmount) > 0
            ? `${order.notes ?? ""}\n[ওভাররাইড] বকেয়া সহ ডেলিভারি: ${body.override_reason}`.trim()
            : order.notes,
      })
      .where(eq(orders.id, id))
      .returning();

    await tx.insert(orderStatusHistory).values({
      orderId: id,
      fromStatus: order.status,
      toStatus: to,
      note: body.note ?? (to === "delivered" && body.override_due ? `বকেয়া সহ ডেলিভারি: ${body.override_reason}` : null),
      changedBy: staff.name,
    });

    // item-level status follows the order (items share the pipeline in MVP)
    await tx
      .update((await import("@/db/schema")).orderItems)
      .set({ status: to, updatedAt: new Date() })
      .where(eq((await import("@/db/schema")).orderItems.orderId, id));

    return { status: 200, order: updated } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: { code: "STATE_ERROR", message: result.error } }, { status: result.status });
  }
  return NextResponse.json({ ok: true, status: result.order.status });
}

export const POST = adminRoute(changeStatus);
