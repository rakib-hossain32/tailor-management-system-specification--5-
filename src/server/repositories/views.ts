import "server-only";
import { getViewConfig } from "drizzle-orm/pg-core";

/** Drizzle nested selections need the view's columns, with their exact types. */
export function viewFields<T extends { _: { selectedFields: Record<string, unknown> } }>(view: T): T["_"]["selectedFields"] {
  return getViewConfig(view as unknown as Parameters<typeof getViewConfig>[0]).selectedFields as T["_"]["selectedFields"];
}
