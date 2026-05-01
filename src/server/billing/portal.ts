import 'server-only'

import { getDodo } from '@/lib/dodo'

import { ensureDodoCustomer } from './customer'

/**
 * Open a Dodo-hosted Customer Portal session so the user can update
 * their card, view invoices, change plan, or cancel.
 */
export async function createPortalSession(input: {
  userId: string
  email: string
  fullName: string | null
}): Promise<string> {
  const customerId = await ensureDodoCustomer(input)

  const dodo = getDodo()
  const session = await dodo.customers.customerPortal.create(customerId, {
    send_email: false,
  })

  return session.link
}
