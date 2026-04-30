import 'server-only'

import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'

import { db, schema } from '@/db/client'
import type { PlanSlug } from './plans'

const VALID_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
] as const
type StripeSubscriptionStatus = (typeof VALID_STATUSES)[number]

function normalizeStatus(s: string): StripeSubscriptionStatus {
  return (VALID_STATUSES as readonly string[]).includes(s)
    ? (s as StripeSubscriptionStatus)
    : 'incomplete'
}

/**
 * Apply a Stripe Subscription event to our database. Called from the
 * webhook handler. Idempotent — re-running for the same subscription
 * with stale data is safe (we always overwrite from the source of truth).
 */
export async function syncSubscriptionFromStripe(sub: Stripe.Subscription): Promise<void> {
  const userId = (sub.metadata?.user_id ?? '').trim()
  const planSlugRaw = (sub.metadata?.plan_slug ?? '').trim()
  if (!userId) {
    console.warn(`[stripe] subscription ${sub.id} missing user_id in metadata; skipping`)
    return
  }

  const planSlug: PlanSlug = ['free', 'pro', 'agency'].includes(planSlugRaw)
    ? (planSlugRaw as PlanSlug)
    : 'pro'

  const status = normalizeStatus(sub.status)
  const periodStart = sub.items.data[0]?.current_period_start
  const periodEnd = sub.items.data[0]?.current_period_end

  const values = {
    userId,
    planSlug,
    status,
    stripeSubscriptionId: sub.id,
    currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    updatedAt: new Date(),
  } satisfies Partial<typeof schema.subscriptions.$inferInsert>

  // Upsert by stripe_subscription_id (unique).
  const existing = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.stripeSubscriptionId, sub.id))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(schema.subscriptions)
      .set(values)
      .where(eq(schema.subscriptions.stripeSubscriptionId, sub.id))
  } else {
    await db.insert(schema.subscriptions).values(values)
  }
}

/**
 * Mark a subscription canceled when Stripe sends the deletion event.
 */
export async function markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
  await db
    .update(schema.subscriptions)
    .set({
      status: 'canceled',
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId))
}
