'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const emailSchema = z.email().max(254)

export type SignInState = {
  ok?: boolean
  message?: string
}

/**
 * Server Action: send a magic-link email. The user clicks it and lands at
 * /auth/callback with a code that's exchanged for a session.
 */
export async function sendMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = emailSchema.safeParse(String(formData.get('email') ?? ''))
  if (!parsed.success) {
    return { ok: false, message: 'Please enter a valid email address.' }
  }

  const next = String(formData.get('next') ?? '/dashboard')
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${env.APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  return {
    ok: true,
    message: 'Check your inbox — we sent you a magic link.',
  }
}

/**
 * Server Action: start the Google OAuth flow. Redirects the browser to
 * Google's consent screen.
 */
export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get('next') ?? '/dashboard')
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${env.APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: 'select_account' },
    },
  })

  if (error || !data?.url) {
    redirect(`/sign-in?error=${encodeURIComponent(error?.message ?? 'oauth-failed')}`)
  }

  redirect(data.url)
}

/**
 * Server Action: end the session and clear auth cookies.
 */
export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/')
}
