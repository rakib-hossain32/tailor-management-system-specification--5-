import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { garmentSchemaVersions } from "@/db/schema";

/** Historical labels and style choices come from the schema that was measured. */
export async function getPinnedMeasurementSchemas(sets: { garmentSchemaVersionId: string }[]) {
  const ids = [...new Set(sets.map((set) => set.garmentSchemaVersionId))];
  const rows = ids.length ? await db.select().from(garmentSchemaVersions).where(inArray(garmentSchemaVersions.id, ids)) : [];
  if (rows.length !== ids.length) throw new Error("A pinned measurement schema is missing");
  return new Map(rows.map((schema) => [schema.id, schema]));
}
