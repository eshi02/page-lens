import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-svh max-w-5xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
        Phase 1 · Foundation ready
      </span>

      <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
        Landingcheck
      </h1>

      <p className="max-w-prose text-pretty text-lg text-muted-foreground">
        AI-graded landing page audits in 30 seconds. The auth, audit, and
        billing flows are coming online next — this is the bootstrap.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/sign-in" className={buttonVariants({ size: 'lg' })}>
          Sign in (coming soon)
        </Link>
        <Link
          href="/pricing"
          className={buttonVariants({ size: 'lg', variant: 'outline' })}
        >
          See pricing
        </Link>
      </div>
    </main>
  )
}
