import 'server-only'

import { and, eq, gte } from 'drizzle-orm'

import { db, schema } from '@/db/client'

import {
  canonicalize,
  contentHash,
  readCache,
  urlHash,
  writeCache,
} from './cache'
import { extractFromHtml } from './extract'
import { fetchHtml } from './fetch-html'
import { gradeWithGemini, type AuditPayload } from './gemini'
import { getQuotaState, type QuotaState } from './quota'
import { recordIssueStats } from './stats'
import { validateUrl } from './url-guard'

const RECENT_AUDIT_WINDOW_MS = 24 * 60 * 60 * 1000 // matches cache TTL

/**
 * Returns true if THIS user has already audited THIS url within the
 * cache window. When true, we bypass the cache for this run — the user's
 * intent is "give me fresh data" (they may have changed the page since
 * their last audit). The cache stays in place for *other* users so the
 * cost-saving behavior is preserved.
 */
async function userHasRecentlyAudited(
  userId: string,
  hash: string,
): Promise<boolean> {
  const since = new Date(Date.now() - RECENT_AUDIT_WINDOW_MS)
  const [row] = await db
    .select({ id: schema.audits.id })
    .from(schema.audits)
    .where(
      and(
        eq(schema.audits.userId, userId),
        eq(schema.audits.urlHash, hash),
        gte(schema.audits.createdAt, since),
      ),
    )
    .limit(1)
  return !!row
}

export type RunAuditResult =
  | {
      ok: true
      audit: { id: string; url: string; createdAt: Date } & AuditPayload
      cached: boolean
      quota: QuotaState
    }
  | { ok: false; error: string; code: 'invalid-url' | 'quota' | 'fetch' | 'gemini' | 'unknown' }

/**
 * The full audit pipeline. Order matters:
 *   1. validate URL  (cheap; fail fast on garbage / SSRF)
 *   2. quota check   (cheap; bail before any Gemini cost)
 *   3. cache check   (cheap; reuse a recent audit of the same URL)
 *   4. fetch + Gemini (expensive; only if cache missed)
 *   5. write cache + audit row
 */
export async function runAudit(
  userId: string,
  inputUrl: string,
): Promise<RunAuditResult> {
  // 1. URL guard
  const guarded = await validateUrl(inputUrl)
  if (!guarded.ok) {
    return { ok: false, error: guarded.reason, code: 'invalid-url' }
  }

  // 2. Quota
  const quotaBefore = await getQuotaState(userId)
  if (quotaBefore.limit !== -1 && quotaBefore.remaining <= 0) {
    return {
      ok: false,
      code: 'quota',
      error: `You've used all ${quotaBefore.limit} audits in your ${quotaBefore.windowDays}-day window. Upgrade to Pro for unlimited audits.`,
    }
  }

  // 3. Fetch + extract — runs every audit. Network is cheap; the
  //    expensive call is Gemini, which we still skip on cache hit.
  //    Doing this *before* the cache check is what makes the cache
  //    accurate: we key on the actual page content, so a page that
  //    has changed since its last audit naturally cache-misses and
  //    gets re-graded, even for a different user.
  const canonical = canonicalize(guarded.url)
  const urlH = urlHash(canonical)

  const fetched = await fetchHtml(guarded.url)
  if (!fetched.ok) {
    return { ok: false, error: fetched.reason, code: 'fetch' }
  }
  const extracted = extractFromHtml(fetched.html, fetched.finalUrl)
  const cacheKey = contentHash(extracted)

  // 4. Cache lookup — bypassed when this user re-runs the same URL
  //    (intent: "give me fresh data even if my page looks the same"),
  //    served otherwise. Keyed on content, not URL, so unrelated users
  //    auditing a page that changed since first audit get fresh grades.
  const bypassCache = await userHasRecentlyAudited(userId, urlH)
  const cached = bypassCache ? null : await readCache(cacheKey)

  let payload: AuditPayload
  let usedCache = false

  if (cached) {
    payload = cached.payload
    usedCache = true
  } else {
    // 5. Grade with Gemini
    try {
      payload = await gradeWithGemini(extracted)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Gemini error'
      return { ok: false, error: message, code: 'gemini' }
    }

    // Cache the fresh result keyed on content hash. Other users hitting
    // this same content within the TTL benefit from the same grade —
    // even if they accessed it via a different URL (e.g. ?utm=...).
    await writeCache(cacheKey, canonical, payload)
  }

  // 6. Persist user-facing audit row. The audits table tracks per-user
  // history keyed by URL (not content), so the same user re-auditing
  // the same URL still groups in their history even when the page changes.
  const [row] = await db
    .insert(schema.audits)
    .values({
      userId,
      url: canonical,
      urlHash: urlH,
      status: 'success',
      score: payload.score,
      summary: payload.summary,
      issues: payload.issues,
    })
    .returning({
      id: schema.audits.id,
      createdAt: schema.audits.createdAt,
    })

  // Bump per-user issue stats — only on fresh audits, not cache hits.
  // Cache hits return the same issues we'd have already counted on
  // first run; double-counting would inflate the dashboard's "top
  // recurring issues" card.
  if (!usedCache && row) {
    await recordIssueStats(userId, payload.issues, row.createdAt)
  }

  const quotaAfter = await getQuotaState(userId)

  return {
    ok: true,
    cached: usedCache,
    quota: quotaAfter,
    audit: {
      id: row.id,
      url: canonical,
      createdAt: row.createdAt,
      ...payload,
    },
  }
}
