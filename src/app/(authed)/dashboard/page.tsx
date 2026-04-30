import Link from 'next/link'
import { redirect } from 'next/navigation'

import { db, schema } from '@/db/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getQuotaState } from '@/server/audit/quota'
import { desc, eq } from 'drizzle-orm'

import { AuditForm } from './_audit-form'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/dashboard')

  const [quota, recent] = await Promise.all([
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
  ])

  const displayName = (user.user_metadata?.full_name as string | undefined) ?? null

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {displayName ? `Hi ${displayName.split(' ')[0]} —` : 'Welcome —'}{' '}
          paste a URL to grade it.
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          We grade pages on 30+ conversion heuristics: hero clarity, CTA placement,
          social proof, friction signals, and more. Audits run in ~5 seconds.
        </p>
      </div>

      {quota.plan === 'free' && quota.limit > 0 && quota.remaining === 0 ? (
        <div className="mt-8 rounded-lg border border-primary/30 bg-primary/5 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                You've used all {quota.limit} audits in your free 30-day window.
              </p>
              <p className="text-xs text-muted-foreground">
                Upgrade to Pro for unlimited audits and saved history.
              </p>
            </div>
            <Link
              href="/billing"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Upgrade to Pro →
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mt-10">
        <AuditForm
          initialQuotaUsed={quota.used}
          initialQuotaLimit={quota.limit}
        />
      </div>

      {recent.length > 0 ? (
        <section className="mt-12 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent audits</h2>
            <Link
              href="/audits"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-border/40 rounded-md border border-border/40">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/audits/${a.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={`min-w-[42px] text-right font-mono text-sm tabular-nums ${scoreColor(a.score)}`}
                  >
                    {a.score ?? '—'}
                  </span>
                  <span className="flex-1 truncate text-sm">{stripScheme(a.url)}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {timeAgo(a.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}

function stripScheme(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function scoreColor(score: number | null) {
  if (score === null) return 'text-muted-foreground'
  if (score >= 75) return 'text-emerald-500'
  if (score >= 50) return 'text-amber-500'
  return 'text-rose-500'
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
