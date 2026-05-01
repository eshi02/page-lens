import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Sparkline } from '@/components/sparkline'
import { db, schema } from '@/db/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getQuotaState } from '@/server/audit/quota'
import { getTopIssues } from '@/server/audit/stats'
import { desc, eq } from 'drizzle-orm'

import { AuditForm } from './_audit-form'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/dashboard')

  const { url: prefillUrl } = await searchParams

  const [quota, recent, trendRows, topRecurringIssues, proPlan] = await Promise.all([
    getQuotaState(user.id),
    db
      .select({
        id: schema.audits.id,
        url: schema.audits.url,
        score: schema.audits.score,
        createdAt: schema.audits.createdAt,
      })
      .from(schema.audits)
      .where(eq(schema.audits.userId, user.id))
      .orderBy(desc(schema.audits.createdAt))
      .limit(5),
    // Trend data: oldest → newest of last 12 audits, only those with a score.
    db
      .select({ score: schema.audits.score })
      .from(schema.audits)
      .where(eq(schema.audits.userId, user.id))
      .orderBy(desc(schema.audits.createdAt))
      .limit(12),
    // Top recurring issues — single indexed read against the
    // denormalized user_issue_stats table. Maintained by recordIssueStats
    // on every fresh audit; constant-time regardless of audit count.
    getTopIssues(user.id, 5),
    db
      .select({ priceCents: schema.plans.priceCents })
      .from(schema.plans)
      .where(eq(schema.plans.slug, 'pro'))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ])

  const trendScores = trendRows
    .map((r) => r.score)
    .filter((s): s is number => s != null)
    .reverse() // oldest → newest for the sparkline

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? null
  const firstName = displayName?.split(' ')[0]
  const proPriceCents = proPlan?.priceCents ?? 1200

  return (
    <main className="relative">
      {/* Gradient mesh anchor — sits behind the hero card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-mesh dark:bg-mesh"
      />

      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="max-w-3xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            AI-graded · 30+ heuristics · ~5s
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {firstName ? (
              <>
                <span className="text-muted-foreground">Hi {firstName} —</span>{' '}
                <span>paste a URL,</span>
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-br from-primary via-primary/70 to-primary/40 bg-clip-text text-transparent">
                  get a graded audit.
                </span>
              </>
            ) : (
              <>
                <span>Paste a URL,</span>
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-br from-primary via-primary/70 to-primary/40 bg-clip-text text-transparent">
                  get a graded audit.
                </span>
              </>
            )}
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            A 0–100 score and a specific, actionable list of fixes — in under five seconds.
          </p>
        </div>

        {quota.plan === 'free' && quota.trial.endsAt && !quota.trial.active ? (
          <div className="max-w-3xl">
            <UpsellBanner
              kind="trial-ended"
              limit={quota.limit}
              windowDays={quota.windowDays}
              proPriceCents={proPriceCents}
            />
          </div>
        ) : quota.plan === 'free' && quota.limit > 0 && quota.remaining === 0 ? (
          <div className="max-w-3xl">
            <UpsellBanner
              kind={quota.trial.active ? 'trial-daily-cap' : 'quota-exhausted'}
              limit={quota.limit}
              windowDays={quota.windowDays}
              proPriceCents={proPriceCents}
            />
          </div>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main column — primary task surface */}
          <div className="flex min-w-0 flex-col gap-8">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 shadow-2xl shadow-primary/5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-700 delay-150 fill-mode-backwards">
              <AuditForm
                initialQuotaUsed={quota.used}
                initialQuotaLimit={quota.limit}
                initialWindowDays={quota.windowDays}
                prefillUrl={prefillUrl ?? null}
                trialDaysLeft={quota.trial.active ? quota.trial.daysLeft : null}
              />
            </div>

            {recent.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium tracking-tight">Recent audits</h2>
                  <Link
                    href="/audits"
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    View all →
                  </Link>
                </div>
                <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur">
                  {recent.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/audits/${a.id}`}
                        className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                      >
                        <span
                          className={`min-w-[44px] text-right font-mono text-base font-medium tabular-nums ${scoreColor(a.score)}`}
                        >
                          {a.score ?? '—'}
                        </span>
                        <span className="flex-1 truncate font-mono text-sm">
                          {stripScheme(a.url)}
                        </span>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {timeAgo(a.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Heuristic showcase only for new users (no audits yet). Once
                they have data, the side rail's score trend + top issues
                replace this product-education content. */}
            {recent.length === 0 ? <HeuristicShowcase /> : null}
          </div>

          {/* Side rail — score trend, recurring issues, daily tip.
              Sample data shows ONLY for users with zero audits. The
              moment they have one real audit, both cards flip to their
              real data — never blend sample with real. */}
          <aside className="flex min-w-0 flex-col gap-4">
            <ScoreTrendCard
              scores={trendScores.length > 0 ? trendScores : SAMPLE_SCORES}
              isSample={trendScores.length === 0}
            />
            <TopIssuesCard
              issues={
                topRecurringIssues.length > 0 ? topRecurringIssues : SAMPLE_TOP_ISSUES
              }
              isSample={topRecurringIssues.length === 0}
            />
            <ProTipCard />
          </aside>
        </div>

        <p className="mt-16 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          LandingCheck · v1 · beta
        </p>
      </div>
    </main>
  )
}

function UpsellBanner({
  kind,
  limit,
  windowDays,
  proPriceCents,
}: {
  kind: 'trial-ended' | 'quota-exhausted' | 'trial-daily-cap'
  limit: number
  windowDays: number
  proPriceCents: number
}) {
  const headline =
    kind === 'trial-ended'
      ? 'Your 14-day free trial ended.'
      : kind === 'trial-daily-cap'
        ? `You've used all ${limit} of today's trial audits.`
        : `You've used all ${limit} audits in your free ${windowDays}-day window.`

  const features = [
    '15 audits per day',
    'Full audit history',
    'PDF report exports',
    'Compare 2 pages side-by-side',
  ]

  const priceLabel = `$${Math.round(proPriceCents / 100)}/mo`

  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl border border-primary/30 bg-card/40 p-6 backdrop-blur shadow-2xl shadow-primary/10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="flex items-center gap-2">
        <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
          {kind === 'trial-ended' ? 'Trial ended' : 'Free limit reached'}
        </span>
      </div>

      <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
        {headline}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Upgrade to Pro for unlimited audits, full history, PDF exports, and side-by-side
        comparisons.
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
            >
              ✓
            </span>
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/billing"
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
        >
          Upgrade to Pro — {priceLabel}
        </Link>
        <Link
          href="/billing"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          See all plans →
        </Link>
      </div>
    </div>
  )
}

// Synthetic data shown to new users so the dashboard feels alive on
// first visit. Picked to look plausible — gentle upward trend
// suggesting the user iterates and improves over time.
const SAMPLE_SCORES = [54, 61, 58, 67, 72, 70, 78]

const SAMPLE_TOP_ISSUES: Array<{
  key: string
  count: number
  severity: 'error' | 'warning'
}> = [
  { key: 'cta-copy', count: 4, severity: 'warning' },
  { key: 'social-proof', count: 3, severity: 'error' },
  { key: 'headline-specificity', count: 3, severity: 'warning' },
  { key: 'pricing-transparency', count: 2, severity: 'warning' },
  { key: 'hero-clarity', count: 2, severity: 'error' },
]

function ScoreTrendCard({
  scores,
  isSample = false,
}: {
  scores: number[]
  isSample?: boolean
}) {
  const latest = scores[scores.length - 1] ?? 0
  const previous = scores[scores.length - 2] ?? latest
  const delta = latest - previous
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const tone = scoreTone(latest)
  const hasTrend = scores.length >= 2

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {hasTrend ? 'Score trend' : 'Latest score'}
        </span>
        {isSample ? (
          <span className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Preview
          </span>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">
            {scores.length} {scores.length === 1 ? 'audit' : 'audits'}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={`font-mono text-3xl font-semibold tabular-nums ${tone}`}>
          {latest}
        </span>
        {hasTrend ? (
          <span
            className={`font-mono text-xs tabular-nums ${
              delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-muted-foreground'
            }`}
          >
            {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {Math.abs(delta)}
          </span>
        ) : null}
        {hasTrend ? (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            avg {avg}
          </span>
        ) : (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            run more audits to see your trend
          </span>
        )}
      </div>

      {hasTrend ? (
        <div className={`mt-3 ${tone}`}>
          <Sparkline values={scores} height={56} className="w-full" ariaLabel="Score trend" />
        </div>
      ) : null}
    </div>
  )
}

function TopIssuesCard({
  issues,
  isSample = false,
}: {
  issues: Array<{ key: string; count: number; severity: 'error' | 'warning' }>
  isSample?: boolean
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Top recurring issues
        </span>
        {isSample ? (
          <span className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Preview
          </span>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">
            across your audits
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {issues.map((i) => (
          <li key={i.key} className="flex items-center gap-3">
            <span
              aria-hidden
              className={`size-1.5 shrink-0 rounded-full ${
                i.severity === 'error' ? 'bg-rose-400' : 'bg-amber-400'
              }`}
            />
            <span className="flex-1 truncate text-sm capitalize">
              {i.key.replace(/-/g, ' ')}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              ×{i.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function scoreTone(score: number) {
  if (score >= 75) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-rose-400'
}


// Conversion-rate tips drawn from common findings across the heuristic
// set. Picks one deterministically per day so the dashboard refreshes
// with new content but doesn't churn on every reload.
const PRO_TIPS: Array<{ tag: string; title: string; body: string }> = [
  {
    tag: 'Headline',
    title: 'Specific beats clever, every time.',
    body: '"Send invoices in 30 seconds" outperforms "All-in-one platform" by 3-5x in landing-page tests. Lead with the verb-noun-time-saved formula.',
  },
  {
    tag: 'CTA copy',
    title: 'Replace "Submit" with the outcome.',
    body: 'Generic CTAs ("Click here", "Submit", "Learn more") convert worse than outcome-led copy ("Start free trial", "Get the audit"). Tell users what they get on the next click.',
  },
  {
    tag: 'Social proof',
    title: 'Name the customer, name the result.',
    body: 'Anonymous testimonials lift trust by ~10%. Named testimonials with a specific result ("Cut onboarding from 3 hours to 12 minutes — Sarah, ACME Inc.") lift trust by ~40%.',
  },
  {
    tag: 'Pricing',
    title: 'Hidden pricing is friction, not strategy.',
    body: 'For sub-$200/mo SaaS, "Contact us for pricing" reduces sign-ups by 25-40%. Show the number — even if it\'s a starting price with "from".',
  },
  {
    tag: 'Hero',
    title: 'The hero must answer "what is this?" in <5s.',
    body: 'A confused visitor leaves. Your H1 + sub-headline + first CTA must communicate (a) who it\'s for, (b) what it does, (c) what they get — without scrolling.',
  },
  {
    tag: 'Forms',
    title: 'Every extra field costs ~10% of conversions.',
    body: 'Sign-up forms with 5+ fields convert ~50% worse than 2-field forms. Ask for what you must, defer the rest to onboarding.',
  },
  {
    tag: 'Above the fold',
    title: 'No CTA in the first viewport = no conversions.',
    body: 'Your primary CTA should be visible without scrolling on a 1366×768 laptop. If it\'s not, you\'re trusting visitors to keep reading — most won\'t.',
  },
]

function ProTipCard() {
  // Rotate tips by date so each calendar day gets a different one.
  const dayIdx = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % PRO_TIPS.length
  const tip = PRO_TIPS[dayIdx] ?? PRO_TIPS[0]
  if (!tip) return null

  return (
    <section className="mt-12 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-backwards">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Pro tip · daily
            </span>
          </div>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            {tip.tag}
          </span>
        </div>
        <h3 className="mt-3 text-xl font-medium tracking-tight sm:text-2xl">
          {tip.title}
        </h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {tip.body}
        </p>
      </div>
    </section>
  )
}

function HeuristicShowcase() {
  // Sample of the heuristics our Gemini prompt grades against.
  // Visible signal of product depth without needing to run an audit.
  const groups: Array<{ label: string; items: string[]; tone: 'good' | 'warn' | 'bad' }> = [
    {
      label: 'Clarity & Value',
      tone: 'good',
      items: ['hero clarity', 'headline specificity', 'value proposition', 'target audience'],
    },
    {
      label: 'Conversion Drivers',
      tone: 'warn',
      items: ['CTA placement', 'CTA copy', 'social proof', 'trust signals', 'pricing transparency'],
    },
    {
      label: 'Friction & Trust',
      tone: 'bad',
      items: ['form friction', 'jargon density', 'objection handling', 'visual hierarchy'],
    },
  ]

  const dot = (tone: 'good' | 'warn' | 'bad') =>
    tone === 'good'
      ? 'bg-emerald-400'
      : tone === 'warn'
        ? 'bg-amber-400'
        : 'bg-rose-400'

  return (
    <section className="mt-16 space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">What we grade</h2>
          <p className="text-sm text-muted-foreground">
            A sample of the 30+ heuristics each audit scores against, across three categories.
          </p>
        </div>
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
          v1 · AI-graded
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {groups.map((g) => (
          <div
            key={g.label}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/70"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
            />
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${dot(g.tone)}`} aria-hidden />
              <h3 className="text-sm font-medium">{g.label}</h3>
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {g.items.map((item) => (
                <li
                  key={item}
                  className="rounded-md border border-border/40 bg-background/40 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors group-hover:text-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
        + {30 - groups.flatMap((g) => g.items).length} more, including meta tags, mobile
        readiness, copy clarity, and visual hierarchy.
      </p>
    </section>
  )
}

function stripScheme(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function scoreColor(score: number | null) {
  if (score === null) return 'text-muted-foreground'
  if (score >= 75) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-rose-400'
}

function timeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}
