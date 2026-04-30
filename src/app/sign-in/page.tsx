import Link from 'next/link'
import type { Metadata } from 'next'

import { SignInForm } from './_form'

export const metadata: Metadata = {
  title: 'Sign in',
}

type SearchParams = Promise<{ next?: string; error?: string }>

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { next = '/dashboard', error } = await searchParams

  return (
    <main className="relative mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back home
      </Link>

      <div className="space-y-2 text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-tight">Sign in to Landingcheck</h1>
        <p className="text-pretty text-sm text-muted-foreground">
          We'll email you a magic link — no password needed.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="w-full rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {decodeURIComponent(error)}
        </div>
      ) : null}

      <SignInForm next={next} />

      <p className="text-balance text-center text-xs text-muted-foreground">
        By signing in you agree to our{' '}
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  )
}
