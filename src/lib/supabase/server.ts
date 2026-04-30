import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from '@/lib/env'

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads/writes the auth cookies that ssr middleware refreshes.
 *
 * Note: cookies().set() throws inside RSCs (read-only context). The try/catch
 * around setAll lets the middleware handle session refresh while RSCs can
 * still read the session safely.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components can't set cookies — middleware does it instead.
        }
      },
    },
  })
}
