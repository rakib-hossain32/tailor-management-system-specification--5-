/** Keep verified TLS semantics explicit across future node-postgres versions. */
export function databaseConnectionUrl(value: string) {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must use PostgreSQL");
  const mode = url.searchParams.get("sslmode");
  if (["prefer", "require", "verify-ca"].includes(mode ?? "")) url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
