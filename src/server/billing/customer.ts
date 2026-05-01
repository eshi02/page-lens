import 'server-only'

import { eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import { getDodo } from '@/lib/dodo'

/**
 * Returns the user's Dodo Payments customer ID, creating one if it doesn't
 * exist. Idempotent: safe to call on every checkout/portal access.
 */
export async function ensureDodoCustomer(input: {
  userId: string
  email: string
  fullName: string | null
}): Promise<string> {
  const [profile] = await db
    .select({ dodoCustomerId: schema.profiles.dodoCustomerId })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, input.userId))
    .limit(1)

  if (profile?.dodoCustomerId) {
    return profile.dodoCustomerId
  }

  const dodo = getDodo()
  const customer = await dodo.customers.create({
    email: input.email,
    name: input.fullName ?? input.email,
  })

  await db
    .update(schema.profiles)
    .set({ dodoCustomerId: customer.customer_id, updatedAt: new Date() })
    .where(eq(schema.profiles.id, input.userId))

  return customer.customer_id
}
