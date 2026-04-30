import 'server-only'

import { env } from '@/lib/env'
import { getStripe } from '@/lib/stripe'

import { ensureStripeCustomer } from './customer'
import { getPlanBySlug, type PlanSlug } from './plans'

/**
 * Create a Stripe Checkout Session for Pro or Agency.
 * Returns the URL the browser should redirect to.
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
  if (!plan.stripePriceId) {
    throw new Error(
      `Plan "${plan.slug}" has no stripe_price_id. Run the seed-stripe script after creating prices in your Stripe dashboard.`,
    )
  }

  const customerId = await ensureStripeCustomer({
    userId: input.userId,
    email: input.email,
    fullName: input.fullName,
  })

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    allow_promotion_codes: true,
    automatic_tax: { enabled: true }, // Stripe Tax handles GST/VAT
    customer_update: { address: 'auto', name: 'auto' },
    billing_address_collection: 'required',
    success_url: `${env.APP_URL}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/billing?status=cancelled`,
    metadata: {
      user_id: input.userId,
      plan_slug: input.planSlug,
    },
    subscription_data: {
      metadata: {
        user_id: input.userId,
        plan_slug: input.planSlug,
      },
    },
  })

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.')
  }
  return session.url
}
