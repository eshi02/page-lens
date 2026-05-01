import 'server-only'

import { env } from '@/lib/env'
import { getDodo } from '@/lib/dodo'

import { ensureDodoCustomer } from './customer'
import { getPlanBySlug, type PlanSlug } from './plans'

/**
 * Create a Dodo Payments Checkout Session for Pro or Agency.
 * Returns the URL the browser should redirect to.
 *
 * Dodo is a Merchant of Record — they handle global tax (GST/VAT/sales
 * tax) automatically based on the buyer's billing country. No tax setup
 * needed on our side.
 */
export async function createCheckoutSession(input: {
  userId: string
  email: string
  fullName: string | null
  planSlug: Extract<PlanSlug, 'pro' | 'agency'>
}): Promise<string> {
  const plan = await getPlanBySlug(input.planSlug)
  if (!plan) {
    throw new Error(`Unknown plan: ${input.planSlug}`)
  }
  if (!plan.dodoProductId) {
    throw new Error(
      `Plan "${plan.slug}" has no dodo_product_id. Create a recurring product in your Dodo dashboard, then UPDATE plans SET dodo_product_id = '...' WHERE slug = '${plan.slug}'.`,
    )
  }

  const customerId = await ensureDodoCustomer({
    userId: input.userId,
    email: input.email,
    fullName: input.fullName,
  })

  const dodo = getDodo()
  const session = await dodo.checkoutSessions.create({
    product_cart: [{ product_id: plan.dodoProductId, quantity: 1 }],
    customer: { customer_id: customerId },
    return_url: `${env.APP_URL}/billing?status=success`,
    metadata: {
      user_id: input.userId,
      plan_slug: input.planSlug,
    },
  })

  if (!session.checkout_url) {
    throw new Error('Dodo did not return a checkout URL.')
  }
  return session.checkout_url
}
