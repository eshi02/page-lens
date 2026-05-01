import 'server-only'

import { and, count, eq, gte } from 'drizzle-orm'

import { db, schema } from '@/db/client'

const MONTH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000 // 1 day

/**
 * Quota tiers:
 *   - Free: 3 audits / 30 days
 *   - Trial: 3 audits / day for 14 days (Free with a daily window)
 *   - Pro: 15 audits / day
 *   - Agency: unlimited (the upgrade path beyond Pro's daily cap)
 */
const FREE_MONTHLY_QUOTA = 3
const TRIAL_DAILY_QUOTA = 3
const PRO_DAILY_QUOTA = 15

export type QuotaState = {
  plan: 'free' | 'pro' | 'agency'
  used: number
  limit: number // -1 = unlimited
  remaining: number // Number.POSITIVE_INFINITY when unlimited
  windowDays: number // window over which `used` is computed
  resetsAt: Date | null // earliest audit timestamp + windowMs; null when unlimited
  trial: {
    active: boolean
    endsAt: Date | null
    daysLeft: number | null
  }
}

/**
 * Returns the user's quota state.
 *
 * - **Trial active** → plan='free', limit=3, window=1 day. Trial is a
 *   feature *of* the Free plan, not a separate Pro plan.
 * - **Free, no/expired trial** → plan='free', limit=3, window=30 days.
 * - **Pro / Agency** → plan reported as-is, unlimited.
 */
export async function getQuotaState(userId: string): Promise<QuotaState> {
  const [paidPlan, trial] = await Promise.all([
    readUserPlan(userId),
    readTrialState(userId),
  ])

  // Agency → unlimited.
  if (paidPlan === 'agency') {
    return {
      plan: 'agency',
      used: 0,
      limit: -1,
      remaining: Number.POSITIVE_INFINITY,
      windowDays: 30,
      resetsAt: null,
      trial,
    }
  }

  // Pro → 15 audits per day.
  if (paidPlan === 'pro') {
    const since = new Date(Date.now() - DAY_WINDOW_MS)
    const used = await countAuditsSince(userId, since)
    return {
      plan: 'pro',
      used,
      limit: PRO_DAILY_QUOTA,
      remaining: Math.max(0, PRO_DAILY_QUOTA - used),
      windowDays: 1,
      resetsAt: new Date(since.getTime() + DAY_WINDOW_MS),
      trial,
    }
  }

  // Free + trial active → 3 audits per day.
  if (trial.active) {
    const since = new Date(Date.now() - DAY_WINDOW_MS)
    const used = await countAuditsSince(userId, since)
    return {
      plan: 'free',
      used,
      limit: TRIAL_DAILY_QUOTA,
      remaining: Math.max(0, TRIAL_DAILY_QUOTA - used),
      windowDays: 1,
      resetsAt: new Date(since.getTime() + DAY_WINDOW_MS),
      trial,
    }
  }

  // Free, no trial → 3 audits per 30 days.
  const since = new Date(Date.now() - MONTH_WINDOW_MS)
  const used = await countAuditsSince(userId, since)
  return {
    plan: 'free',
    used,
    limit: FREE_MONTHLY_QUOTA,
    remaining: Math.max(0, FREE_MONTHLY_QUOTA - used),
    windowDays: 30,
    resetsAt: new Date(since.getTime() + MONTH_WINDOW_MS),
    trial,
  }
}

async function countAuditsSince(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.audits)
    .where(
      and(
        eq(schema.audits.userId, userId),
        gte(schema.audits.createdAt, since),
      ),
    )
  return Number(row?.value ?? 0)
}

/**
 * Reads the user's active paid plan slug. Falls back to 'free' for
 * users without an active paid subscription.
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

async function readTrialState(userId: string): Promise<QuotaState['trial']> {
  const [row] = await db
    .select({ trialEndsAt: schema.profiles.trialEndsAt })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, userId))
    .limit(1)

  const endsAt = row?.trialEndsAt ?? null
  if (!endsAt) return { active: false, endsAt: null, daysLeft: null }

  const msLeft = endsAt.getTime() - Date.now()
  if (msLeft <= 0) return { active: false, endsAt, daysLeft: null }

  return {
    active: true,
    endsAt,
    daysLeft: Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
  }
}
