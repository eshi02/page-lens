import 'server-only'

import { env } from '@/lib/env'
import { getStripe } from '@/lib/stripe'

import { ensureStripeCustomer } from './customer'

/**
 * Open a Stripe-hosted Customer Portal session so the user can update
 * their card, view invoices, change plan, or cancel.
 */
export async function createPortalSession(input: {
  userId: string
  email: string
  fullName: string | null
}): Promise<string> {
  const customerId = await ensureStripeCustomer(input)

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.APP_URL}/billing`,
  })

  return session.url
}
