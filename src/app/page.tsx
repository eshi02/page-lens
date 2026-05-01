import Link from 'next/link'

import { ThemeToggle } from '@/components/theme-toggle'
import { buttonVariants } from '@/components/ui/button'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] bg-mesh"
      />

      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-5 rounded-md bg-gradient-to-br from-primary via-primary/70 to-primary/40 ring-1 ring-primary/40"
          />
          <span className="text-sm font-semibold tracking-tight">Landingcheck</span>
          <span
            className="hidden rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary sm:inline-block"
            title="Beta — features may change"
          >
            Beta
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link href="/dashboard" className={buttonVariants({ size: 'sm' })}>
              Dashboard
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className={buttonVariants({ size: 'sm', variant: 'ghost' })}
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-6 pb-20 pt-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur animate-in fade-in duration-700">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          AI-graded · 30+ heuristics · ~5s
        </span>

        <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl animate-in fade-in slide-in-from-bottom-3 duration-700">
          Your landing page,{' '}
          <span className="bg-gradient-to-br from-primary via-primary/70 to-primary/40 bg-clip-text text-transparent">
            graded honestly
          </span>{' '}
          in 30 seconds.
        </h1>

        <p className="max-w-prose text-pretty text-lg text-muted-foreground animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100 fill-mode-backwards">
          Paste a URL, get a score out of 100 plus a specific, actionable list of conversion fixes.
          Cheaper than a CRO consultant — by a few orders of magnitude.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-200 fill-mode-backwards">
          {user ? (
            <Link href="/dashboard" className={buttonVariants({ size: 'lg' })}>
              Go to dashboard →
            </Link>
          ) : (
            <Link href="/sign-in" className={buttonVariants({ size: 'lg' })}>
              Start free — 3 audits →
            </Link>
          )}
          <Link
            href={user ? '/billing' : '/sign-in'}
            className={buttonVariants({ size: 'lg', variant: 'outline' })}
          >
            See pricing
          </Link>
        </div>

        <SampleScoreCard />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="mb-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Three steps. One URL. No hand-holding.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Step
            n="01"
            title="Paste any URL"
            body="Public pages only. We block private IPs and cloud-metadata endpoints by default."
          />
          <Step
            n="02"
            title="We extract & analyze"
            body="Hero, CTAs, copy, social proof, friction signals, meta tags — graded against 30+ CRO heuristics."
          />
          <Step
            n="03"
            title="Score + fix list"
            body="A 0–100 score and a prioritized list of issues with specific, actionable copy fixes."
          />
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-border/40 px-6 py-8 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono">© 2026 Landingcheck</span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            All systems operational
          </span>
        </div>
      </footer>
    </main>
  )
}

function SampleScoreCard() {
  return (
    <div className="mt-8 w-full max-w-md animate-in fade-in zoom-in-95 duration-700 delay-300 fill-mode-backwards">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl glow-primary">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-transparent to-transparent"
        />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Sample audit
          </span>
          <span className="font-mono text-xs text-muted-foreground">stripe.com</span>
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-mono text-6xl font-semibold tabular-nums tracking-tight text-emerald-400">
            93
          </span>
          <span className="font-mono text-xl text-muted-foreground">/100</span>
        </div>
        <p className="mt-1 text-left text-sm">
          Excellent — clear value prop, prominent CTAs, strong social proof.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[
            { label: 'hero clarity', tone: 'good' },
            { label: 'CTA placement', tone: 'good' },
            { label: 'social proof', tone: 'good' },
            { label: 'pricing transparency', tone: 'warn' },
          ].map((t) => (
            <span
              key={t.label}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                t.tone === 'good'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${t.tone === 'good' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                aria-hidden
              />
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/30">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <span className="font-mono text-xs text-muted-foreground">{n}</span>
      <h3 className="mt-2 text-base font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
