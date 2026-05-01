'use client'

import { AnimatedScore } from '@/components/animated-score'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { AuditIssue } from '@/db/schema'
import type { RunAuditResult } from '@/server/audit/run-audit'

type SuccessResult = Extract<RunAuditResult, { ok: true }>

export function AuditResult({
  result,
  onReset,
}: {
  result: SuccessResult
  onReset: () => void
}) {
  const { audit } = result
  const grouped = groupIssues(audit.issues)
  const totalIssues = grouped.error.length + grouped.warning.length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Audit result
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          Audit another page
        </Button>
      </div>

      <Card className={`relative overflow-hidden ${scoreGlow(audit.score)}`}>
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${scoreGradient(audit.score)} opacity-60`}
        />
        <CardContent className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-baseline gap-1">
            <AnimatedScore
              value={audit.score}
              className={`font-mono text-7xl font-semibold tabular-nums tracking-tight ${scoreColor(audit.score)}`}
            />
            <span className="font-mono text-2xl text-muted-foreground">/100</span>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-medium">{scoreLabel(audit.score)}</div>
            <a
              href={audit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {audit.url} ↗
            </a>
            {audit.summary ? (
              <p className="pt-1 text-sm text-muted-foreground">{audit.summary}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 border-y border-border/40 py-3 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{totalIssues}</strong>{' '}
          {totalIssues === 1 ? 'thing' : 'things'} to fix ·{' '}
          <strong className="text-foreground">{grouped.good.length}</strong> passing
        </span>
      </div>

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

function groupIssues(issues: AuditIssue[]) {
  return {
    error: issues.filter((i) => i.severity === 'error'),
    warning: issues.filter((i) => i.severity === 'warning'),
    good: issues.filter((i) => i.severity === 'good'),
  }
}

function scoreColor(score: number) {
  if (score >= 75) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-rose-400'
}

function scoreGlow(score: number) {
  if (score >= 75) return 'glow-good'
  if (score >= 50) return 'glow-warn'
  return 'glow-bad'
}

function scoreGradient(score: number) {
  if (score >= 75) return 'from-emerald-500/10 via-transparent to-transparent'
  if (score >= 50) return 'from-amber-500/10 via-transparent to-transparent'
  return 'from-rose-500/10 via-transparent to-transparent'
}

function scoreLabel(score: number) {
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
