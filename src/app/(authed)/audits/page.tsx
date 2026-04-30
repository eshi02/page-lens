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

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Audits</p>
        <h1 className="text-3xl font-semibold tracking-tight">Your audit history</h1>
        <p className="text-sm text-muted-foreground">
          Latest {audits.length} {audits.length === 1 ? 'audit' : 'audits'}.
        </p>
      </div>

      <div className="mt-8">
        {audits.length === 0 ? (
          <div className="rounded-lg border border-border/40 bg-card/40 px-6 py-10 text-center text-sm text-muted-foreground">
            No audits yet.{' '}
            <Link href="/dashboard" className="underline underline-offset-4 hover:text-foreground">
              Run your first audit
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y divide-border/40 rounded-md border border-border/40">
            {audits.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/audits/${a.id}`}
                  className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={`min-w-[48px] text-right font-mono text-base tabular-nums ${scoreColor(a.score)}`}
                  >
                    {a.score ?? '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{stripScheme(a.url)}</div>
                    {a.summary ? (
                      <div className="line-clamp-2 text-xs text-muted-foreground">
                        {a.summary}
                      </div>
                    ) : null}
                  </div>
                  <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                    {timeAgo(a.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
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
