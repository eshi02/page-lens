import Link from 'next/link'
import type { Metadata } from 'next'

import { ThemeToggle } from '@/components/theme-toggle'

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
    <main className="relative min-h-svh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-mesh"
      />

      <div className="flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <span aria-hidden>←</span> Back home
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-7 px-6 pb-16 pt-16">
        <div className="space-y-2 text-center animate-in fade-in slide-in-from-bottom-2 duration-500 delay-75 fill-mode-backwards">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Sign in to{' '}
            <span className="bg-gradient-to-br from-primary via-primary/70 to-primary/40 bg-clip-text text-transparent">
              LandingCheck
            </span>
          </h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Magic link via email or Google sign-in. No passwords, ever.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive backdrop-blur"
          >
            {decodeURIComponent(error)}
          </div>
        ) : null}

        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 shadow-2xl shadow-primary/5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500 delay-150 fill-mode-backwards">
          <SignInForm next={next} />
        </div>

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
      </div>
    </main>
  )
}
