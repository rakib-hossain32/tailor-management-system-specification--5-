import "server-only";
import { and, asc, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { startOfToday } from "@/lib/format";

/**
 * Appointment list queries for the staff dashboards — one module, one
 * job: reading appointment lists for display. (Writes and the booking
 * flow live in ./appointments and ../cms/booking.)
 *
 * Why "upcoming" exists: the dashboards used to show TODAY only. A
 * customer almost always books for a future day, so a fresh booking
 * was invisible on both the dashboard home and the appointments page —
 * the shop saw an empty list and concluded the booking never arrived.
 * The default staff view is therefore everything from today onward;
 * a single day is shown only when a day is explicitly picked.
 */

export type AppointmentListRow = typeof appointments.$inferSelect;

/** Every appointment from the start of today onward, soonest first. */
export async function listUpcomingAppointments(limit = 60): Promise<AppointmentListRow[]> {
  return db
    .select()
    .from(appointments)
    .where(and(gte(appointments.startsAt, startOfToday()), ne(appointments.status, "cancelled")))
    .orderBy(asc(appointments.startsAt))
    .limit(limit);
}

/** One calendar day (server-local), earliest first — explicit day view. */
export async function listAppointmentsForDay(date: string): Promise<AppointmentListRow[]> {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        gte(appointments.startsAt, new Date(`${date}T00:00:00`)),
        lt(appointments.startsAt, new Date(`${date}T23:59:59`)),
      ),
    )
    .orderBy(asc(appointments.startsAt));
}
