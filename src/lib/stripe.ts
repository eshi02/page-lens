import 'server-only'

import Stripe from 'stripe'

import { env } from '@/lib/env'

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.')
  }
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    // Pin the API version so silently-changed Stripe behavior never
    // breaks our webhook handler. Bump this deliberately when reviewing
    // upstream changelogs.
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    appInfo: {
      name: 'Landingcheck',
      version: '0.1.0',
    },
  })
  return cached
}
