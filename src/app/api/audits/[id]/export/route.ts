import { after } from 'next/server'
import { NextResponse, type NextRequest } from 'next/server'

import { db, schema } from '@/db/client'
import { rateLimit } from '@/lib/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getQuotaState } from '@/server/audit/quota'
import { toCsv, toMarkdown } from '@/server/audit/export'
import { enqueuePdfJob, renderPdfJob } from '@/server/audit/pdf-queue'
import { and, eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORMATS = ['md', 'csv', 'pdf'] as const
type Format = (typeof FORMATS)[number]

function isFormat(v: string | null): v is Format {
  return v != null && (FORMATS as readonly string[]).includes(v)
}

function safeFilename(url: string, ext: string) {
  const slug = url
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'audit'
  return `pagelens-${slug}.${ext}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const format = req.nextUrl.searchParams.get('format')
  if (!isFormat(format)) {
    return NextResponse.json(
      { error: 'Invalid format. Use ?format=md|csv|pdf' },
      { status: 400 },
    )
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Burst protection: 30 exports/min per user. Cheap call, but PDF
  // rendering uses CPU and we don't want a script to saturate an
  // instance with concurrent renders.
  const rl = await rateLimit('export', `user:${user.id}`)
  if (!rl.ok) {
    const resetSec = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: `Rate limited. Try again in ${resetSec}s.` },
      {
        status: 429,
        headers: {
          'retry-after': String(resetSec),
          'x-ratelimit-limit': String(rl.limit),
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(rl.reset / 1000)),
        },
      },
    )
  }

  // PDF is gated behind an actual paid plan (Pro / Agency). Trial users
  // do NOT get PDF — that's the carrot for upgrading. Markdown + CSV
  // are free for any signed-in user.
  if (format === 'pdf') {
    const quota = await getQuotaState(user.id)
    if (quota.plan === 'free') {
      return NextResponse.json(
        {
          error: 'PDF export is a Pro feature. Upgrade to unlock.',
        },
        { status: 402 },
      )
    }
  }

  const [audit] = await db
    .select({
      url: schema.audits.url,
      score: schema.audits.score,
      summary: schema.audits.summary,
      createdAt: schema.audits.createdAt,
      issues: schema.audits.issues,
    })
    .from(schema.audits)
    .where(and(eq(schema.audits.id, id), eq(schema.audits.userId, user.id)))
    .limit(1)

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found.' }, { status: 404 })
  }

  if (format === 'md') {
    return new NextResponse(toMarkdown(audit), {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${safeFilename(audit.url, 'md')}"`,
      },
    })
  }

  if (format === 'csv') {
    return new NextResponse(toCsv(audit), {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${safeFilename(audit.url, 'csv')}"`,
      },
    })
  }

  // PDF: queue + render in background. Response returns immediately
  // with the job id; the client polls GET /api/exports/[jobId] for
  // status and the file bytes when ready.
  const { jobId } = await enqueuePdfJob(user.id, id)
  // `after` (Next 15+) keeps the runtime alive past response close so
  // the render completes even though the HTTP response has been sent.
  after(async () => {
    await renderPdfJob(jobId)
  })
  return NextResponse.json(
    { jobId, status: 'pending', filename: safeFilename(audit.url, 'pdf') },
    { status: 202 },
  )
}
