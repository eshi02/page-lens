import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/env'
import { cleanupExpiredCache } from '@/server/audit/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Internal scheduled-task endpoint. Wire up Cloud Scheduler (or any
 * cron tool) to hit this nightly with the shared secret in the
 * Authorization header.
 *
 *   gcloud scheduler jobs create http audit-cache-cleanup \
 *     --schedule="0 3 * * *" \
 *     --uri=https://landingcheck.app/api/internal/cleanup \
 *     --http-method=POST \
 *     --headers="Authorization=Bearer $INTERNAL_CRON_SECRET"
 */
export async function POST(req: NextRequest) {
  if (!env.INTERNAL_CRON_SECRET) {
    return NextResponse.json(
      { error: 'INTERNAL_CRON_SECRET not configured.' },
      { status: 500 },
    )
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${env.INTERNAL_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const start = Date.now()
  const cache = await cleanupExpiredCache()
  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    deleted: { auditCache: cache.deleted },
  })
}
