import 'server-only'

import { and, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import { log } from '@/lib/logger'

import { renderAuditPdf } from './pdf-report'

type ExportableAudit = {
  url: string
  score: number | null
  summary: string | null
  createdAt: Date
  issues: ReturnType<typeof Object> | null
}

/**
 * Queue a PDF render job. Returns the job id immediately. The actual
 * render runs in the background via the caller's `waitUntil` (Next.js
 * runtime keeps the instance alive past response close).
 */
export async function enqueuePdfJob(
  userId: string,
  auditId: string,
): Promise<{ jobId: string }> {
  const [row] = await db
    .insert(schema.exportJobs)
    .values({
      userId,
      auditId,
      format: 'pdf',
      status: 'pending',
    })
    .returning({ id: schema.exportJobs.id })
  if (!row) throw new Error('Failed to enqueue PDF job.')
  return { jobId: row.id }
}

/**
 * Render a queued PDF job. Idempotent on retry — if the job is already
 * 'done' or 'processing' (claimed by another instance), bails out.
 *
 * Errors are caught and recorded on the job row so the client can
 * surface them; we don't rethrow because this runs detached from the
 * HTTP response.
 */
export async function renderPdfJob(jobId: string): Promise<void> {
  // Atomically claim: pending → processing. If 0 rows updated, another
  // worker grabbed it (or it's already done/failed). Bail without error.
  const claimed = await db
    .update(schema.exportJobs)
    .set({ status: 'processing' })
    .where(and(eq(schema.exportJobs.id, jobId), eq(schema.exportJobs.status, 'pending')))
    .returning({
      id: schema.exportJobs.id,
      auditId: schema.exportJobs.auditId,
      userId: schema.exportJobs.userId,
    })

  const job = claimed[0]
  if (!job) {
    log.info('pdf-queue: job already claimed or finished', { jobId })
    return
  }

  try {
    const [audit] = await db
      .select({
        url: schema.audits.url,
        score: schema.audits.score,
        summary: schema.audits.summary,
        createdAt: schema.audits.createdAt,
        issues: schema.audits.issues,
      })
      .from(schema.audits)
      .where(
        and(eq(schema.audits.id, job.auditId), eq(schema.audits.userId, job.userId)),
      )
      .limit(1)

    if (!audit) {
      throw new Error('Audit not found or not owned by user')
    }

    const start = Date.now()
    const pdf = await renderAuditPdf(audit as ExportableAudit & {
      url: string
      score: number | null
      summary: string | null
      createdAt: Date
    })

    await db
      .update(schema.exportJobs)
      .set({
        status: 'done',
        pdfData: pdf,
        completedAt: new Date(),
      })
      .where(eq(schema.exportJobs.id, jobId))

    log.info('pdf-queue: job done', {
      jobId,
      auditId: job.auditId,
      durationMs: Date.now() - start,
      sizeBytes: pdf.length,
    })
  } catch (err) {
    log.error('pdf-queue: render failed', err, { jobId, auditId: job.auditId })
    await db
      .update(schema.exportJobs)
      .set({
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(schema.exportJobs.id, jobId))
  }
}
