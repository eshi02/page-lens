import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'

import { env } from '@/lib/env'
import { getStripe } from '@/lib/stripe'
import {
  markSubscriptionCanceled,
  syncSubscriptionFromStripe,
} from '@/server/billing/sync'

export const runtime = 'nodejs'
// Stripe webhook bodies must be the *raw* bytes — disable body parsing.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Stripe is not configured on the server.' },
      { status: 500 },
    )
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  const rawBody = await req.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[stripe] webhook signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.resumed':
      case 'customer.subscription.paused':
      case 'customer.subscription.trial_will_end': {
        await syncSubscriptionFromStripe(event.data.object)
        break
      }
      case 'customer.subscription.deleted': {
        await markSubscriptionCanceled(event.data.object.id)
        break
      }
      case 'checkout.session.completed': {
        // The subscription.created event already syncs us — but we
        // double-check by pulling the subscription off the session
        // and syncing again. Belt and braces; both are idempotent.
        const session = event.data.object
        if (session.mode === 'subscription' && typeof session.subscription === 'string') {
          const sub = await stripe.subscriptions.retrieve(session.subscription)
          await syncSubscriptionFromStripe(sub)
        }
        break
      }
      default:
        // Other events ignored. Stripe sends ~80 event types; we only
        // care about subscription lifecycle.
        break
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe] handler failed for event', event.type, message)
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 })
  }
}
