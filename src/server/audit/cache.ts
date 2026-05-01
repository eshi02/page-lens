import 'server-only'

import { createHash } from 'node:crypto'

import { and, eq, gt, lt } from 'drizzle-orm'

import { db, schema } from '@/db/client'

import type { Extracted } from './extract'
import type { AuditPayload } from './gemini'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

/**
 * Hash the URL we use as the cache key. We canonicalise first so
 * `https://example.com`, `https://example.com/`, and `HTTPS://Example.COM`
 * all collapse to the same key.
 */
export function canonicalize(url: URL): string {
  const u = new URL(url.toString())
  u.hostname = u.hostname.toLowerCase()
  u.protocol = u.protocol.toLowerCase()
  u.hash = ''
  if (u.pathname === '') u.pathname = '/'
  // Strip the trailing slash for paths longer than '/'
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1)
  }
  return u.toString()
}

export function urlHash(canonicalUrl: string): string {
  return createHash('sha256').update(canonicalUrl).digest('hex')
}

/**
 * Hash the *extracted page content* — what the AI actually grades. The
 * cache is keyed on this rather than the URL so that when a page changes
 * (copy edits, A/B test rollout, redesign) different users running an
 * audit get a fresh grade reflecting the current state, instead of a
 * stale audit baked from an earlier snapshot.
 *
 * We hash the extracted struct rather than raw HTML so that
 * semantically-irrelevant churn (whitespace, comments, CSRF tokens,
 * tracking pixels, dynamic class hashes) doesn't bust the cache.
 */
export function contentHash(extracted: Extracted): string {
  const canonical = JSON.stringify({
    title: extracted.title,
    metaDescription: extracted.metaDescription,
    ogTitle: extracted.ogTitle,
    ogDescription: extracted.ogDescription,
    viewport: extracted.viewport,
    headings: extracted.headings,
    ctas: extracted.ctas,
    navLinks: extracted.navLinks,
    bodyText: extracted.bodyText,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export async function readCache(hash: string): Promise<{
  url: string
  payload: AuditPayload
} | null> {
  const [row] = await db
    .select({
      url: schema.auditCache.url,
      score: schema.auditCache.score,
      summary: schema.auditCache.summary,
      issues: schema.auditCache.issues,
    })
    .from(schema.auditCache)
    .where(
      and(
        eq(schema.auditCache.urlHash, hash),
        gt(schema.auditCache.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!row) return null
  return {
    url: row.url,
    payload: {
      score: row.score,
      summary: row.summary,
      issues: row.issues ?? [],
    },
  }
}

/**
 * Bulk-delete expired cache entries. Safe to run idempotently — works
 * by `expires_at` rather than TTL math, so concurrent invocations from
 * multiple Cloud Run instances can't double-delete or miss rows.
 *
 * Wire this up via a cron in production (Supabase pg_cron, or a Cloud
 * Scheduler hitting a /api/internal/cleanup endpoint nightly).
 */
export async function cleanupExpiredCache(): Promise<{ deleted: number }> {
  const now = new Date()
  const result = await db
    .delete(schema.auditCache)
    .where(lt(schema.auditCache.expiresAt, now))
    .returning({ urlHash: schema.auditCache.urlHash })
  return { deleted: result.length }
}

export async function writeCache(
  hash: string,
  url: string,
  payload: AuditPayload,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS)
  await db
    .insert(schema.auditCache)
    .values({
      urlHash: hash,
      url,
      score: payload.score,
      summary: payload.summary,
      issues: payload.issues,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: schema.auditCache.urlHash,
      set: {
        url,
        score: payload.score,
        summary: payload.summary,
        issues: payload.issues,
        expiresAt,
      },
    })
}
