import Link from 'next/link'
import { redirect } from 'next/navigation'

import { db, schema } from '@/db/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export default async function AuditsListPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/audits')

  const audits = await db
    .select({
      id: schema.audits.id,
      url: schema.audits.url,
      score: schema.audits.score,
      summary: schema.audits.summary,
      createdAt: schema.audits.createdAt,
    })
    .from(schema.audits)
    .where(eq(schema.audits.userId, user.id))
    .orderBy(desc(schema.audits.createdAt))
    .limit(PAGE_SIZE)

  const stats = computeStats(audits)

  return (
    <main className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[280px] bg-mesh"
      />
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Audits · history
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Your audit{' '}
            <span className="bg-gradient-to-br from-primary via-primary/70 to-primary/40 bg-clip-text text-transparent">
              history
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {audits.length === 0
              ? 'Nothing here yet.'
              : `Latest ${audits.length} ${audits.length === 1 ? 'audit' : 'audits'}.`}
          </p>
        </div>

        {audits.length > 0 ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 fill-mode-backwards">
            <StatCard label="Average score" value={stats.avg ?? '—'} tone={scoreTone(stats.avg)} />
            <StatCard label="Best score" value={stats.best ?? '—'} tone="good" />
            <StatCard label="Total audited" value={String(audits.length)} tone="neutral" />
          </div>
        ) : null}

        <div className="mt-8">
          {audits.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-card/40 px-6 py-12 text-center backdrop-blur">
              <p className="text-sm text-muted-foreground">No audits yet.</p>
              <Link
                href="/dashboard"
                className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Run your first audit →
              </Link>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur divide-y divide-border/40">
              {audits.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/audits/${a.id}`}
                    className="group grid grid-cols-[auto_1fr_auto] items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                  >
                    <ScoreChip score={a.score} />
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-medium transition-colors group-hover:text-primary">
                        {stripScheme(a.url)}
                      </div>
                      {a.summary ? (
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {a.summary}
                        </div>
                      ) : null}
                    </div>
                    <span className="hidden whitespace-nowrap font-mono text-[11px] text-muted-foreground sm:inline">
                      {timeAgo(a.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}

function ScoreChip({ score }: { score: number | null }) {
  const color = scoreColor(score)
  return (
    <span
      className={`inline-flex h-10 min-w-[56px] items-center justify-center rounded-lg border border-border/60 bg-background/60 font-mono text-base font-medium tabular-nums ${color}`}
    >
      {score ?? '—'}
    </span>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'good' | 'warn' | 'bad' | 'neutral'
}) {
  const accent =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : tone === 'bad'
          ? 'text-rose-400'
          : 'text-foreground'
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

function computeStats(audits: { score: number | null }[]) {
  const scored = audits.map((a) => a.score).filter((s): s is number => s != null)
  if (scored.length === 0) return { avg: null, best: null }
  const avg = Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
  const best = Math.max(...scored)
  return { avg, best }
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

function scoreTone(score: number | null): 'good' | 'warn' | 'bad' | 'neutral' {
  if (score === null) return 'neutral'
  if (score >= 75) return 'good'
  if (score >= 50) return 'warn'
  return 'bad'
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
