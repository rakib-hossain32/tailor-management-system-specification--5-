import "server-only";
import { and, count, eq, gt, inArray, lt, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { appointmentRecords, orderRecords, taskRecords } from "@/db/schema";
import { dhakaDate } from "@/lib/appointments";

/**
 * Sidebar attention counts — the numbers that tell the owner, at a
 * glance from any page, what has arrived and what is waiting:
 *  - appointments: new online bookings (status "booked") still ahead
 *  - orders: orders received/confirmed but not yet in production
 *  - overdue: delivery date passed, order not delivered
 *  - tasks: work assigned to a tailor but not started
 * A badge only renders when its count is above zero. Any failure
 * returns zeros — the shell must never break over a badge.
 */
export interface NavBadges {
  appointments: number;
  orders: number;
  overdue: number;
  tasks: number;
}

const ZERO: NavBadges = { appointments: 0, orders: 0, overdue: 0, tasks: 0 };

export async function getNavBadges(): Promise<NavBadges> {
  try {
    const today = dhakaDate();
    const [appt, ord, over, tsk] = await Promise.all([
      db
        .select({ n: count() })
        .from(appointmentRecords)
        .where(and(eq(appointmentRecords.status, "booked"), gt(appointmentRecords.startsAt, new Date()))),
      db
        .select({ n: count() })
        .from(orderRecords)
        .where(inArray(orderRecords.status, ["requested", "confirmed"])),
      db
        .select({ n: count() })
        .from(orderRecords)
        .where(
          and(
            lt(orderRecords.deliveryDate, today),
            notInArray(orderRecords.status, ["delivered", "cancelled", "draft"]),
          ),
        ),
      db
        .select({ n: count() })
        .from(taskRecords)
        .where(eq(taskRecords.status, "assigned")),
    ]);
    return {
      appointments: appt[0]?.n ?? 0,
      orders: ord[0]?.n ?? 0,
      overdue: over[0]?.n ?? 0,
      tasks: tsk[0]?.n ?? 0,
    };
  } catch {
    return ZERO;
  }
}
