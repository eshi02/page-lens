import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { AnimatedScore } from '@/components/animated-score'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { db, schema } from '@/db/client'
import type { AuditIssue } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getQuotaState } from '@/server/audit/quota'
import { and, eq } from 'drizzle-orm'

import { ExportDropdown } from './_export-dropdown'

export const dynamic = 'force-dynamic'

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=/audits/${id}`)

  const [[audit], quota] = await Promise.all([
    db
      .select()
      .from(schema.audits)
      .where(and(eq(schema.audits.id, id), eq(schema.audits.userId, user.id)))
      .limit(1),
    getQuotaState(user.id),
  ])

  if (!audit) notFound()

  // PDF export is a paid-tier feature. Trial users see the lock badge
  // and are routed to /billing.
  const isPro = quota.plan !== 'free'

  const issues = (audit.issues ?? []) as AuditIssue[]
  const grouped = {
    error: issues.filter((i) => i.severity === 'error'),
    warning: issues.filter((i) => i.severity === 'warning'),
    good: issues.filter((i) => i.severity === 'good'),
  }
  const totalIssues = grouped.error.length + grouped.warning.length

  return (
    <main className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-mesh"
      />
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="mb-8 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Link
            href="/audits"
            className="inline-flex items-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
          >
            ← All audits
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {audit.createdAt.toLocaleString()}
          </p>
          <h1 className="break-all text-2xl font-semibold tracking-tight sm:text-3xl">
            <a
              href={audit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-foreground/90 transition-colors hover:text-primary"
            >
              {stripScheme(audit.url)}
              <span className="ml-1 text-muted-foreground">↗</span>
            </a>
          </h1>
        </div>

        <Card
          className={`relative overflow-hidden animate-in fade-in zoom-in-95 duration-500 delay-100 fill-mode-backwards ${scoreGlow(audit.score)}`}
        >
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${scoreGradient(audit.score)} opacity-60`}
          />
          <CardContent className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex items-baseline gap-1">
              {audit.score !== null ? (
                <AnimatedScore
                  value={audit.score}
                  className={`font-mono text-7xl font-semibold tabular-nums tracking-tight ${scoreColor(audit.score)}`}
                />
              ) : (
                <span className="font-mono text-7xl font-semibold tabular-nums tracking-tight text-muted-foreground">
                  —
                </span>
              )}
              <span className="font-mono text-2xl text-muted-foreground">/100</span>
            </div>
            <div className="space-y-2">
              <div className="text-lg font-medium">{scoreLabel(audit.score)}</div>
              {audit.summary ? (
                <p className="text-sm text-muted-foreground">{audit.summary}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/dashboard?url=${encodeURIComponent(audit.url)}`}
                  className={buttonVariants({ size: 'sm', variant: 'outline' })}
                >
                  ↻ Re-audit this URL
                </Link>
                <ExportDropdown auditId={audit.id} isPro={isPro} />
                <a
                  href={audit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                >
                  Open page ↗
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <CountTile label="Critical" value={grouped.error.length} tone="bad" />
          <CountTile label="Needs work" value={grouped.warning.length} tone="warn" />
          <CountTile label="Passing" value={grouped.good.length} tone="good" />
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 border-y border-border/40 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>
            <strong className="text-foreground">{totalIssues}</strong>{' '}
            {totalIssues === 1 ? 'thing' : 'things'} to fix
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-8">
          {grouped.error.length > 0 ? (
            <IssueGroup title="Critical" tone="error" issues={grouped.error} />
          ) : null}
          {grouped.warning.length > 0 ? (
            <IssueGroup title="Needs work" tone="warning" issues={grouped.warning} />
          ) : null}
          {grouped.good.length > 0 ? (
            <IssueGroup title="Passing" tone="good" issues={grouped.good} />
          ) : null}
        </div>
      </div>
    </main>
  )
}

function CountTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'good' | 'warn' | 'bad'
}) {
  const accent =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : 'text-rose-400'
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-3 backdrop-blur">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  )
}

function IssueGroup({
  title,
  tone,
  issues,
}: {
  title: string
  tone: 'error' | 'warning' | 'good'
  issues: AuditIssue[]
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <span className={`size-2 rounded-full ${dotColor(tone)}`} aria-hidden />
        {title}
        <span className="ml-auto tabular-nums">{issues.length}</span>
      </h3>
      <ul className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-xl border border-border/40 bg-card/30 backdrop-blur">
        {issues.map((i) => (
          <li
            key={i.key}
            className="grid grid-cols-[auto_1fr] gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
          >
            <span className={`mt-1.5 size-2 rounded-full ${dotColor(tone)}`} aria-hidden />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium capitalize">{i.key.replace(/-/g, ' ')}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tagClass(tone)}`}
                >
                  {tone === 'error' ? 'Critical' : tone === 'warning' ? 'Note' : 'Pass'}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{i.message}</p>
            </div>
          </li>
        ))}
      </ul>
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

function scoreGlow(score: number | null) {
  if (score === null) return ''
  if (score >= 75) return 'glow-good'
  if (score >= 50) return 'glow-warn'
  return 'glow-bad'
}

function scoreGradient(score: number | null) {
  if (score === null) return 'from-transparent'
  if (score >= 75) return 'from-emerald-500/10 via-transparent to-transparent'
  if (score >= 50) return 'from-amber-500/10 via-transparent to-transparent'
  return 'from-rose-500/10 via-transparent to-transparent'
}

function scoreLabel(score: number | null) {
  if (score === null) return 'No score'
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 50) return 'Needs work'
  if (score >= 25) return 'Rough'
  return 'Critical'
}

function dotColor(tone: 'error' | 'warning' | 'good') {
  if (tone === 'error') return 'bg-rose-400'
  if (tone === 'warning') return 'bg-amber-400'
  return 'bg-emerald-400'
}

function tagClass(tone: 'error' | 'warning' | 'good') {
  if (tone === 'error') return 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
  if (tone === 'warning') return 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
  return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
}
