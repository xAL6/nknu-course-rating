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

/**
 * Client IP for rate-limit keying. Prefer headers the Vercel edge sets and
 * overwrites on every request (so a client can't forge them); only fall back to
 * the client-supplied x-forwarded-for as a last resort. Reading the left-most
 * x-forwarded-for value would let anyone mint a fresh bucket per request.
 */
export function clientIp(req: Request): string {
  const trusted = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip");
  if (trusted) return trusted.split(",")[0].trim();
  // Last resort (non-Vercel / local): take the RIGHT-most XFF hop, which is the
  // closest trusted proxy rather than the spoofable client-supplied left-most.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    return hops[hops.length - 1] ?? "unknown";
  }
  return "unknown";
}
