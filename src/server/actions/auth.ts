'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/server/profiles'

// Google ID tokens are JWTs — three base64url segments separated by dots.
const idTokenSchema = z
  .string()
  .min(1)
  .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/, 'invalid id_token format')

export type GoogleSignInResult = { ok: true; next: string } | { ok: false; error: string }

/**
 * Server Action: complete a Google sign-in started by the GIS button.
 *
 * The browser receives an ID token (JWT) directly from Google via the
 * Google Identity Services SDK and forwards it here. We hand it to
 * Supabase, which verifies the JWT signature against Google's keys and
 * issues us a session — no client secret needed because we're not doing
 * a code-for-token exchange.
 */
export async function signInWithGoogleIdToken(input: {
  idToken: string
  next?: string
}): Promise<GoogleSignInResult> {
  const tokenParse = idTokenSchema.safeParse(input.idToken)
  if (!tokenParse.success) {
    return { ok: false, error: 'Malformed Google credential.' }
  }

  const next = input.next && input.next.startsWith('/') ? input.next : '/dashboard'

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: tokenParse.data,
  })

  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'Google sign-in failed.' }
  }

  await ensureProfile({
    id: data.user.id,
    email: data.user.email ?? '',
    fullName:
      (data.user.user_metadata?.full_name as string | undefined) ??
      (data.user.user_metadata?.name as string | undefined) ??
      null,
    avatarUrl:
      (data.user.user_metadata?.avatar_url as string | undefined) ??
      (data.user.user_metadata?.picture as string | undefined) ??
      null,
  })

  return { ok: true, next }
}

/**
 * Server Action: end the session and clear auth cookies.
 */
export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/')
}
