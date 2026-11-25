import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { appointmentRecords } from "@/db/schema";
import { inArray } from "drizzle-orm";

/**
 * The `appointments.garments` column arrived in migration
 * 0002_appointment_garments. Code that touches it goes through this module
 * so the site keeps working — with a notes-based fallback — on a database
 * where that migration has not been applied yet, instead of failing with
 * a 500 on every booking.
 */
let columnCache: boolean | null = null;

export async function hasGarmentsColumn(): Promise<boolean> {
  if (columnCache !== null) return columnCache;
  try {
    const rows = await db.execute(
      sql`select 1 as ok from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'garments' limit 1`,
    );
    columnCache = (rows as unknown as { rows?: unknown[] }).rows
      ? ((rows as unknown as { rows: unknown[] }).rows.length > 0)
      : ((rows as unknown as unknown[]).length > 0);
  } catch {
    columnCache = false;
  }
  return columnCache;
}

/** Garment names per appointment id; empty when the column is missing. */
export async function garmentsByAppointment(ids: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!ids.length || !(await hasGarmentsColumn())) return result;
  const rows = await db
    .select({ id: appointmentRecords.id, garments: appointmentRecords.garments })
    .from(appointmentRecords)
    .where(inArray(appointmentRecords.id, ids));
  for (const row of rows) result.set(row.id, row.garments ?? []);
  return result;
}

export async function garmentsOfAppointment(id: string): Promise<string[]> {
  const map = await garmentsByAppointment([id]);
  return map.get(id) ?? [];
}

/** Fallback storage when the column is missing: keep the picks in notes. */
export function garmentsNoteLine(garments: string[]): string {
  return garments.length ? `বানাতে চান: ${garments.join(", ")}` : "";
}

export function mergeGarmentsIntoNotes(notes: string | null, garments: string[]): string | null {
  const line = garmentsNoteLine(garments);
  if (!line) return notes;
  if (notes?.includes(line)) return notes;
  return [notes, line].filter(Boolean).join("\n");
}
