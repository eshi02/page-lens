import { z } from 'zod'

/**
 * Single source of truth for environment configuration.
 *
 * Two exports:
 *   - `env`        — the full server-side env. Validated at module load.
 *                    Importing this from a client component will throw.
 *   - `publicEnv`  — only NEXT_PUBLIC_* vars. Safe to import anywhere.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Phase 3+ — required for audits to work, but app boots without it.
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  SENTRY_DSN: z.string().url().optional(),

  APP_URL: z.string().url().default('http://localhost:3000'),
})

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
})

const isServer = typeof window === 'undefined'

/**
 * Treat empty-string env vars as unset. Otherwise Zod's `.url().optional()`
 * still chokes on `""` because the value is technically present.
 */
function blanksToUndefined<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    out[k] = v === '' ? undefined : v
  }
  return out as T
}

/**
 * Server-side env. Throws at import time on the client.
 */
export const env = (() => {
  if (!isServer) {
    throw new Error(
      "src/lib/env.ts: server `env` was imported from the browser. Use `publicEnv` from a client component instead.",
    )
  }
  return serverSchema.parse(blanksToUndefined(process.env))
})()

export const publicEnv = publicSchema.parse(
  blanksToUndefined({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  }),
)

export type Env = typeof env
export type PublicEnv = typeof publicEnv
