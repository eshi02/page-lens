import 'server-only'

import DodoPayments from 'dodopayments'

import { env } from '@/lib/env'

let cached: DodoPayments | null = null

export function getDodo(): DodoPayments {
  if (cached) return cached
  if (!env.DODO_PAYMENTS_API_KEY) {
    throw new Error('DODO_PAYMENTS_API_KEY is not configured.')
  }
  cached = new DodoPayments({
    bearerToken: env.DODO_PAYMENTS_API_KEY,
    environment: env.DODO_ENVIRONMENT,
  })
  return cached
}
