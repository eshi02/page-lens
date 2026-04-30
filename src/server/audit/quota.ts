import 'server-only'

import { and, count, eq, gte } from 'drizzle-orm'

import { db, schema } from '@/db/client'

const ROLLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/**
 * Per-plan caps. -1 means unlimited.
 */
const PLAN_QUOTAS: Record<'free' | 'pro' | 'agency', number> = {
  free: 3,
  pro: -1,
  agency: -1,
}

export type QuotaState = {
  plan: 'free' | 'pro' | 'agency'
  used: number
  limit: number // -1 = unlimited
  remaining: number // Number.POSITIVE_INFINITY when unlimited
  windowDays: number
  resetsAt: Date | null // earliest audit timestamp + windowMs; null when unlimited
}

/**
 * Returns the current user's audit quota state for the rolling 30-day window.
 * Free = 3 audits / 30 days; Pro and Agency are unlimited.
 */
export async function getQuotaState(userId: string): Promise<QuotaState> {
  const plan = await readUserPlan(userId)
  const limit = PLAN_QUOTAS[plan]

  if (limit < 0) {
    return {
      plan,
      used: 0,
      limit: -1,
      remaining: Number.POSITIVE_INFINITY,
      windowDays: 30,
      resetsAt: null,
    }
  }

  const since = new Date(Date.now() - ROLLING_WINDOW_MS)
  const [row] = await db
    .select({ value: count() })
    .from(schema.audits)
    .where(
      and(
        eq(schema.audits.userId, userId),
        gte(schema.audits.createdAt, since),
      ),
    )

  const used = Number(row?.value ?? 0)

  return {
    plan,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    windowDays: 30,
    resetsAt: new Date(since.getTime() + ROLLING_WINDOW_MS),
  }
}

/**
 * Reads the user's active plan slug. Falls back to 'free' for users
 * without a row yet (e.g., right after sign-up before their subscription
 * record is created).
 */
async function readUserPlan(userId: string): Promise<'free' | 'pro' | 'agency'> {
  const [row] = await db
    .select({ planSlug: schema.subscriptions.planSlug })
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, 'active'),
      ),
    )
    .limit(1)

  if (!row) return 'free'
  return row.planSlug
}
