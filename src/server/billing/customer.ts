import 'server-only'

import { eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import { getStripe } from '@/lib/stripe'

/**
 * Returns the user's Stripe customer ID, creating one if it doesn't exist.
 * Idempotent: safe to call on every checkout/portal access.
 */
export async function ensureStripeCustomer(input: {
  userId: string
  email: string
  fullName: string | null
}): Promise<string> {
  const [profile] = await db
    .select({ stripeCustomerId: schema.profiles.stripeCustomerId })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, input.userId))
    .limit(1)

  if (profile?.stripeCustomerId) {
    return profile.stripeCustomerId
  }

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email: input.email,
    name: input.fullName ?? undefined,
    metadata: {
      user_id: input.userId,
    },
  })

  await db
    .update(schema.profiles)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(schema.profiles.id, input.userId))

  return customer.id
}
