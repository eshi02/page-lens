import 'server-only'

import { eq } from 'drizzle-orm'
import type DodoPayments from 'dodopayments'

import { db, schema } from '@/db/client'
import type { PlanSlug } from './plans'

type DodoSubscription = DodoPayments.Subscriptions.Subscription

/**
 * Apply a Dodo Subscription event to our database. Called from the
 * webhook handler. Idempotent — re-running for the same subscription
 * with stale data is safe (we always overwrite from the source of truth).
 */
export async function syncSubscriptionFromDodo(sub: DodoSubscription): Promise<void> {
  const userId = (sub.metadata?.user_id ?? '').trim()
  const planSlugRaw = (sub.metadata?.plan_slug ?? '').trim()
  if (!userId) {
    console.warn(`[dodo] subscription ${sub.subscription_id} missing user_id in metadata; skipping`)
    return
  }

  const planSlug: PlanSlug = ['free', 'pro', 'agency'].includes(planSlugRaw)
    ? (planSlugRaw as PlanSlug)
    : 'pro'

  const periodStart = sub.previous_billing_date ? new Date(sub.previous_billing_date) : null
  const periodEnd = sub.next_billing_date ? new Date(sub.next_billing_date) : null

  const values = {
    userId,
    planSlug,
    status: sub.status,
    dodoSubscriptionId: sub.subscription_id,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: !!sub.cancel_at_next_billing_date,
    updatedAt: new Date(),
  } satisfies Partial<typeof schema.subscriptions.$inferInsert>

  // Upsert by dodo_subscription_id (unique).
  const existing = await db
    .select({ id: schema.subscriptions.id })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.dodoSubscriptionId, sub.subscription_id))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(schema.subscriptions)
      .set(values)
      .where(eq(schema.subscriptions.dodoSubscriptionId, sub.subscription_id))
  } else {
    await db.insert(schema.subscriptions).values(values)
  }
}

/**
 * Mark a subscription cancelled. Dodo emits subscription.cancelled when
 * the user (or merchant) cancels — this is terminal.
 */
export async function markSubscriptionCancelled(dodoSubscriptionId: string): Promise<void> {
  await db
    .update(schema.subscriptions)
    .set({
      status: 'cancelled',
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.dodoSubscriptionId, dodoSubscriptionId))
}
