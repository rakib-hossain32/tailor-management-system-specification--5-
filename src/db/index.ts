import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseConnectionUrl } from "./url";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __tailorPostgresql?: { url: string; pool: Pool };
};
const resolvedUrl = databaseConnectionUrl(databaseUrl);
const cached = globalForDb.__tailorPostgresql;
export const pool = cached?.url === resolvedUrl ? cached.pool : new Pool({
  connectionString: resolvedUrl, max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000,
});

if (process.env.NODE_ENV !== "production") {
  if (cached && cached.pool !== pool) void cached.pool.end().catch(() => {});
  globalForDb.__tailorPostgresql = { url: resolvedUrl, pool };
}

export const db = drizzle(pool);
