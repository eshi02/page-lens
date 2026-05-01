import { NextResponse, type NextRequest } from 'next/server'

import { db, schema } from '@/db/client'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { and, eq } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeFilename(url: string, ext: string) {
  const slug = url
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'audit'
  return `landingcheck-${slug}.${ext}`
}

/**
 * Status / download endpoint for queued export jobs.
 *
 * - `GET /api/exports/[jobId]?download=1` → if job is `done`, streams
 *   the bytes with Content-Disposition. Otherwise 425 (Too Early).
 * - `GET /api/exports/[jobId]` → returns JSON status:
 *     { status: 'pending' | 'processing' | 'done' | 'failed', error? }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const wantsDownload = req.nextUrl.searchParams.get('download') === '1'

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const [job] = await db
    .select({
      id: schema.exportJobs.id,
      status: schema.exportJobs.status,
      format: schema.exportJobs.format,
      auditId: schema.exportJobs.auditId,
      pdfData: schema.exportJobs.pdfData,
      errorMessage: schema.exportJobs.errorMessage,
    })
    .from(schema.exportJobs)
    .where(and(eq(schema.exportJobs.id, jobId), eq(schema.exportJobs.userId, user.id)))
    .limit(1)

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
  }

  if (!wantsDownload) {
    return NextResponse.json({
      status: job.status,
      ...(job.status === 'failed' ? { error: job.errorMessage } : {}),
    })
  }

  // Download path
  if (job.status !== 'done' || !job.pdfData) {
    if (job.status === 'failed') {
      return NextResponse.json(
        { error: job.errorMessage ?? 'Render failed.' },
        { status: 500 },
      )
    }
    return NextResponse.json(
      { status: job.status, error: 'Not ready yet.' },
      { status: 425 },
    )
  }

  // We need the audit URL for the filename. One small extra read; cheap.
  const [audit] = await db
    .select({ url: schema.audits.url })
    .from(schema.audits)
    .where(eq(schema.audits.id, job.auditId))
    .limit(1)
  const filename = safeFilename(audit?.url ?? 'audit', 'pdf')

  return new NextResponse(new Uint8Array(job.pdfData), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}
