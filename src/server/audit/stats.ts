import 'server-only'

import { sql } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type { AuditIssue } from '@/db/schema'

/**
 * Bumps user_issue_stats counters for every issue in a fresh audit.
 * Idempotent at the row-level via UPSERT: if (user_id, issue_key)
 * already exists, we increment; otherwise insert with starting counts.
 *
 * Issues with severity='good' are skipped — those are passing checks,
 * not problems to track.
 *
 * Designed to be called inline after a fresh (non-cached) audit lands.
 * Cache hits intentionally don't bump counts: the issues are the same
 * as the first time, but counting them again would inflate stats.
 */
export async function recordIssueStats(
  userId: string,
  issues: AuditIssue[],
  auditedAt: Date,
): Promise<void> {
  const tracked = issues.filter((i) => i.severity !== 'good')
  if (tracked.length === 0) return

  // One row per unique key in this audit. If the same key appears
  // multiple times in one audit (shouldn't, but defensive), collapse.
  const byKey = new Map<string, { error: number; warning: number }>()
  for (const i of tracked) {
    const cur = byKey.get(i.key) ?? { error: 0, warning: 0 }
    if (i.severity === 'error') cur.error += 1
    else cur.warning += 1
    byKey.set(i.key, cur)
  }

  // ON CONFLICT … DO UPDATE with `excluded.*` references the row we
  // tried to insert. We use SQL `+` so the increment is atomic at the
  // DB level — safe under concurrent audits for the same user.
  for (const [issueKey, counts] of byKey) {
    await db
      .insert(schema.userIssueStats)
      .values({
        userId,
        issueKey,
        errorCount: counts.error,
        warningCount: counts.warning,
        totalCount: counts.error + counts.warning,
        lastSeenAt: auditedAt,
      })
      .onConflictDoUpdate({
        target: [schema.userIssueStats.userId, schema.userIssueStats.issueKey],
        set: {
          errorCount: sql`${schema.userIssueStats.errorCount} + ${counts.error}`,
          warningCount: sql`${schema.userIssueStats.warningCount} + ${counts.warning}`,
          totalCount: sql`${schema.userIssueStats.totalCount} + ${counts.error + counts.warning}`,
          lastSeenAt: auditedAt,
        },
      })
  }
}

/**
 * Read path used by the dashboard. Single indexed query — no JSONB
 * parsing, no client-side aggregation. Returns top N issues by total
 * count, with a deterministic tiebreaker.
 */
export async function getTopIssues(
  userId: string,
  limit = 5,
): Promise<
  Array<{ key: string; count: number; severity: 'error' | 'warning' }>
> {
  const rows = await db
    .select({
      issueKey: schema.userIssueStats.issueKey,
      errorCount: schema.userIssueStats.errorCount,
      warningCount: schema.userIssueStats.warningCount,
      totalCount: schema.userIssueStats.totalCount,
    })
    .from(schema.userIssueStats)
    .where(sql`${schema.userIssueStats.userId} = ${userId}`)
    .orderBy(sql`${schema.userIssueStats.totalCount} DESC, ${schema.userIssueStats.issueKey}`)
    .limit(limit)

  return rows.map((r) => ({
    key: r.issueKey,
    count: r.totalCount,
    severity: r.errorCount >= r.warningCount ? ('error' as const) : ('warning' as const),
  }))
}
