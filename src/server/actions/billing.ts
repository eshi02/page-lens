'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/server/billing/checkout'
import { createPortalSession } from '@/server/billing/portal'

const planSchema = z.enum(['pro', 'agency'])

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Server Action: start a Stripe Checkout session for Pro or Agency.
 * Throws (and Next.js shows the error boundary) if Stripe isn't
 * configured yet.
 */
export async function startCheckout(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/billing')

  const parsed = planSchema.safeParse(formData.get('plan'))
  if (!parsed.success) {
    redirect('/billing?status=invalid-plan')
  }

  const url = await createCheckoutSession({
    userId: user.id,
    email: user.email ?? '',
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
    planSlug: parsed.data,
  })
  redirect(url)
}

/**
 * Server Action: open Stripe's hosted Customer Portal where the user
 * can change card / cancel / view invoices.
 */
export async function openCustomerPortal() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/billing')

  const url = await createPortalSession({
    userId: user.id,
    email: user.email ?? '',
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  })
  redirect(url)
}
