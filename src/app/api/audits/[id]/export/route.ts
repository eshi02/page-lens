import { NextResponse, type NextRequest } from 'next/server'

import { db, schema } from '@/db/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getQuotaState } from '@/server/audit/quota'
import { toCsv, toMarkdown } from '@/server/audit/export'
import { renderAuditPdf } from '@/server/audit/pdf-report'
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
  return `landingcheck-${slug}.${ext}`
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

  // PDF
  const pdf = await renderAuditPdf(audit)
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${safeFilename(audit.url, 'pdf')}"`,
    },
  })
}
