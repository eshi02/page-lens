'use server'

import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/server/billing/checkout'
import { createPortalSession } from '@/server/billing/portal'

const planSchema = z.enum(['pro', 'agency'])

/**
 * Distinguishes "Dodo isn't configured yet" failures (env var missing or
 * dodo_product_id NULL) from any other error class. We surface those as
 * a soft "setup-pending" state on the billing page rather than crashing.
 */
function isDodoNotConfiguredError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    /DODO_PAYMENTS_API_KEY is not configured/.test(err.message) ||
    /no dodo_product_id/i.test(err.message)
  )
}

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Server Action: start a Dodo Payments Checkout session for Pro or Agency.
 * Throws (and Next.js shows the error boundary) if Dodo isn't
 * configured yet.
 */
export async function startCheckout(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/billing')

  const parsed = planSchema.safeParse(formData.get('plan'))
  if (!parsed.success) {
    redirect('/billing?status=invalid-plan')
  }

  let url: string
  try {
    url = await createCheckoutSession({
      userId: user.id,
      email: user.email ?? '',
      fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
      planSlug: parsed.data,
    })
  } catch (err) {
    // Re-throw redirect signals (Next.js uses thrown errors for those)
    if (isRedirectError(err)) throw err
    if (isDodoNotConfiguredError(err)) {
      redirect('/billing?status=setup-pending')
    }
    throw err
  }
  redirect(url)
}

/**
 * Server Action: open Dodo's hosted Customer Portal where the user
 * can change card / cancel / view invoices.
 */
export async function openCustomerPortal() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/billing')

  let url: string
  try {
    url = await createPortalSession({
      userId: user.id,
      email: user.email ?? '',
      fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
    })
  } catch (err) {
    if (isRedirectError(err)) throw err
    if (isDodoNotConfiguredError(err)) {
      redirect('/billing?status=setup-pending')
    }
    throw err
  }
  redirect(url)
}
