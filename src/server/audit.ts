import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export type AppTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type AuditEvent = { actorId?: string | null; action: string; entity: string; entityId: string; details?: Record<string, unknown> };

/** Audit identity and changed fields, never passwords/tokens or copies of whole records. */
export async function recordAudit(tx: AppTransaction | typeof db, event: AuditEvent) {
  const details = Object.fromEntries(Object.entries(event.details ?? {})
    .filter(([key]) => !/password|secret|token|apikey|connection/i.test(key)));
  await tx.insert(auditLogs).values({
    actorId: event.actorId ?? null, action: event.action, entity: event.entity,
    entityId: event.entityId, details,
  });
}
