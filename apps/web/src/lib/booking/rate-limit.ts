/**
 * Simple sliding-window rate limiter (per-process). Adequate for a single
 * web instance; replace with a shared store if the app scales out.
 */
const buckets = new Map<string, number[]>();

/** Dev/test relaxation only — never set in production (defaults to 1). */
const MULTIPLIER = Math.max(1, Number(process.env.RATE_LIMIT_MULTIPLIER ?? 1) || 1);

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit * MULTIPLIER) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    // Prevent unbounded growth under scanning traffic.
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return true;
}
