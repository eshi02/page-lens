import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/server/profiles'

/**
 * OAuth + magic-link callback. Supabase redirects here after the user
 * clicks the link in their email or completes Google consent.
 *
 * - Exchanges the auth code for a session (sets cookies via setAll).
 * - Creates the profile row on first sign-in.
 * - Redirects the user onward to ?next=<path> (default /dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const errorDescription = searchParams.get('error_description')

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(errorDescription)}`,
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing-code`)
  }

  const supabase = await createSupabaseServerClient()
  const { error, data } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    )
  }

  if (data.user) {
    await ensureProfile({
      id: data.user.id,
      email: data.user.email ?? '',
      fullName: data.user.user_metadata?.full_name ?? null,
      avatarUrl: data.user.user_metadata?.avatar_url ?? null,
    })
  }

  // Make sure we never redirect to an off-host URL
  const safeNext = next.startsWith('/') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
