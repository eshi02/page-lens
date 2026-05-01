import 'server-only'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import { env } from '@/lib/env'

/**
 * Distributed rate limiting backed by Upstash Redis. Designed to work
 * correctly across multiple Cloud Run instances — a local in-memory
 * Map would let users bypass limits by hitting different instances.
 *
 * If Upstash isn't configured, rate limiting is silently disabled.
 * That's fine for local dev; in production an env-validation step
 * should catch the missing keys.
 */

let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null
  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  })
  return redis
}

type Bucket = {
  /** Friendly name shown in Upstash analytics. */
  name: string
  /** Max requests per window. */
  limit: number
  /** Sliding window length, e.g. '1 m' or '1 h'. */
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`
}

const BUCKETS = {
  // Audit grading is the most expensive endpoint (Gemini cost + page
  // fetch). 10/min and 100/hour balance "real user iteration" against
  // "runaway script abuse".
  audit: { name: 'audit', limit: 10, window: '1 m' },
  auditHourly: { name: 'audit:hour', limit: 100, window: '1 h' },
  // Export endpoints are cheap (DB read + render) — give a generous cap
  // so users can re-export multiple formats of the same audit.
  export: { name: 'export', limit: 30, window: '1 m' },
} as const satisfies Record<string, Bucket>

const limiters = new Map<keyof typeof BUCKETS, Ratelimit>()

function getLimiter(key: keyof typeof BUCKETS): Ratelimit | null {
  const cached = limiters.get(key)
  if (cached) return cached
  const r = getRedis()
  if (!r) return null
  const cfg = BUCKETS[key]
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(cfg.limit, cfg.window),
    prefix: `lc:${cfg.name}`,
    analytics: true,
  })
  limiters.set(key, limiter)
  return limiter
}

export type RateLimitResult = {
  ok: boolean
  /** Remaining tokens in this window. */
  remaining: number
  /** Unix ms when the window resets. */
  reset: number
  /** Total bucket size for transparency. */
  limit: number
}

/**
 * Check + consume a token for the given bucket. Returns ok=true if the
 * request can proceed. Returns ok=true unconditionally when Upstash
 * isn't configured (local dev).
 */
export async function rateLimit(
  bucket: keyof typeof BUCKETS,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(bucket)
  if (!limiter) {
    return {
      ok: true,
      remaining: BUCKETS[bucket].limit,
      reset: Date.now(),
      limit: BUCKETS[bucket].limit,
    }
  }
  const r = await limiter.limit(identifier)
  return {
    ok: r.success,
    remaining: r.remaining,
    reset: r.reset,
    limit: r.limit,
  }
}

/**
 * Run two limits in parallel — typically a short and long window. The
 * stricter outcome wins. Useful for audit endpoints where we want both
 * burst protection and hourly caps.
 */
export async function rateLimitMulti(
  buckets: Array<keyof typeof BUCKETS>,
  identifier: string,
): Promise<RateLimitResult> {
  const results = await Promise.all(buckets.map((b) => rateLimit(b, identifier)))
  const failing = results.find((r) => !r.ok)
  if (failing) return failing
  // All passed — return the one closest to its cap.
  return results.reduce((min, r) => (r.remaining < min.remaining ? r : min))
}
