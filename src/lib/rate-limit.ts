type Bucket = { count: number; resetAt: number };
const state = globalThis as typeof globalThis & { __tailorRateLimits?: Map<string, Bucket> };
const buckets = state.__tailorRateLimits ??= new Map<string, Bucket>();

/** Fixed windows shared across hot reloads. For multiple servers, replace with a shared store. */
export function takeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  for (const [storedKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(storedKey);
  const current = buckets.get(key);
  if (current && current.count >= limit) return false;
  if (current) current.count += 1;
  else {
    if (buckets.size >= 10000) return false;
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  }
  return true;
}

export function requestClientKey(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local").slice(0, 100);
}
