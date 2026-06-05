import "server-only";

/**
 * Minimal in-memory sliding-window rate limiter. Suitable for a single Fluid
 * Compute instance; for multi-region scale, swap the Map for Upstash/Redis.
 */
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; remaining: number; resetMs: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    return { ok: false, remaining: 0, resetMs: oldest + windowMs - now };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Opportunistic cleanup so the Map doesn't grow unbounded across keys.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }

  return { ok: true, remaining: limit - bucket.hits.length, resetMs: windowMs };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
