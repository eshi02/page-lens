import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Card, CardContent } from '@/components/ui/card'
import { db, schema } from '@/db/client'
import type { AuditIssue } from '@/db/schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { and, eq } from 'drizzle-orm'

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

  const [audit] = await db
    .select()
    .from(schema.audits)
    .where(and(eq(schema.audits.id, id), eq(schema.audits.userId, user.id)))
    .limit(1)

  if (!audit) notFound()

  const issues = (audit.issues ?? []) as AuditIssue[]
  const grouped = {
    error: issues.filter((i) => i.severity === 'error'),
    warning: issues.filter((i) => i.severity === 'warning'),
    good: issues.filter((i) => i.severity === 'good'),
  }
  const totalIssues = grouped.error.length + grouped.warning.length

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-8 space-y-2">
        <Link
          href="/audits"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          ← All audits
        </Link>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {audit.createdAt.toLocaleString()}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          <a
            href={audit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline-offset-4 hover:underline"
          >
            {audit.url}
          </a>
        </h1>
      </div>

      <Card>
        <CardContent className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-baseline gap-1">
            <span
              className={`text-6xl font-semibold tracking-tight ${scoreColor(audit.score)}`}
            >
              {audit.score ?? '—'}
            </span>
            <span className="text-2xl text-muted-foreground">/100</span>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-medium">{scoreLabel(audit.score)}</div>
            {audit.summary ? (
              <p className="text-sm text-muted-foreground">{audit.summary}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 flex items-center justify-between gap-3 border-y border-border/40 py-3 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{totalIssues}</strong>{' '}
          {totalIssues === 1 ? 'thing' : 'things'} to fix ·{' '}
          <strong className="text-foreground">{grouped.good.length}</strong> passing
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-6">
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
    </main>
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
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span className={`size-2 rounded-full ${dotColor(tone)}`} aria-hidden />
        {title}
      </h3>
      <ul className="flex flex-col divide-y divide-border/40">
        {issues.map((i) => (
          <li key={i.key} className="grid grid-cols-[auto_1fr] gap-3 py-3">
            <span className={`mt-1 size-2 rounded-full ${dotColor(tone)}`} aria-hidden />
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

function scoreColor(score: number | null) {
  if (score === null) return 'text-muted-foreground'
  if (score >= 75) return 'text-emerald-500'
  if (score >= 50) return 'text-amber-500'
  return 'text-rose-500'
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
  if (tone === 'error') return 'bg-rose-500'
  if (tone === 'warning') return 'bg-amber-500'
  return 'bg-emerald-500'
}

function tagClass(tone: 'error' | 'warning' | 'good') {
  if (tone === 'error') return 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
  if (tone === 'warning') return 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
  return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
}
