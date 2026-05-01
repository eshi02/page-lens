import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/env'
import { getDodo } from '@/lib/dodo'
import {
  markSubscriptionCancelled,
  syncSubscriptionFromDodo,
} from '@/server/billing/sync'

export const runtime = 'nodejs'
// Dodo webhook bodies must be the *raw* bytes for HMAC verification.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!env.DODO_PAYMENTS_API_KEY || !env.DODO_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Dodo Payments is not configured on the server.' },
      { status: 500 },
    )
  }

  const headers = {
    'webhook-id': req.headers.get('webhook-id') ?? '',
    'webhook-signature': req.headers.get('webhook-signature') ?? '',
    'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
  }
  if (!headers['webhook-id'] || !headers['webhook-signature'] || !headers['webhook-timestamp']) {
    return NextResponse.json(
      { error: 'Missing Standard Webhooks headers.' },
      { status: 400 },
    )
  }

  const rawBody = await req.text()
  const dodo = getDodo()

  let event: ReturnType<typeof dodo.webhooks.unwrap>
  try {
    event = dodo.webhooks.unwrap(rawBody, {
      headers,
      key: env.DODO_WEBHOOK_SECRET,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[dodo] webhook signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'subscription.active':
      case 'subscription.renewed':
      case 'subscription.on_hold':
      case 'subscription.failed':
      case 'subscription.expired':
      case 'subscription.plan_changed':
      case 'subscription.updated': {
        await syncSubscriptionFromDodo(event.data)
        break
      }
      case 'subscription.cancelled': {
        await markSubscriptionCancelled(event.data.subscription_id)
        break
      }
      default:
        // Other events (payment.*, refund.*, dispute.*) ignored — we only
        // care about subscription lifecycle for plan-flipping.
        break
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[dodo] handler failed for event', event.type, message)
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 })
  }
}
