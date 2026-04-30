'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for use in Client Components.
 * Lazily uses the NEXT_PUBLIC_* env vars exposed at build time.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
