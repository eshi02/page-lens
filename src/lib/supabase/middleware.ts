import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/env'

/**
 * Refresh the Supabase session on every request. Without this, expired
 * access tokens are never auto-refreshed and the user gets silently logged
 * out. Returns the response (with refreshed cookies set) which the middleware
 * passes back to Next.js.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // CRITICAL: do NOT remove getUser(). Even if you don't use the result,
  // calling getUser() forces Supabase to refresh the session if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
