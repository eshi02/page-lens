'use client'

import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Format = 'md' | 'csv' | 'pdf'

const ITEMS: Array<{
  format: Format
  label: string
  desc: string
  Icon: typeof FileText
  pro?: boolean
}> = [
  {
    format: 'md',
    label: 'Markdown',
    desc: 'For Notion, Linear, GitHub',
    Icon: FileText,
  },
  {
    format: 'csv',
    label: 'CSV',
    desc: 'Issues as a spreadsheet row',
    Icon: FileSpreadsheet,
  },
  {
    format: 'pdf',
    label: 'PDF report',
    desc: 'Branded, ready to share',
    Icon: Download,
    pro: true,
  },
]

/**
 * Export dropdown for the audit detail page. Free users see Markdown +
 * CSV unlocked and PDF locked. Paid (or trialling) users see all three.
 * Clicking a locked option routes to /billing instead of triggering the
 * download.
 */
export function ExportDropdown({
  auditId,
  isPro,
}: {
  auditId: string
  isPro: boolean
}) {
  const [busyFormat, setBusyFormat] = useState<Format | null>(null)

  async function handleDownload(format: Format) {
    setBusyFormat(format)
    try {
      if (format === 'md' || format === 'csv') {
        // Synchronous endpoint — the response IS the file. Anchor click
        // pulls cookies and lets the browser handle Save As.
        const a = document.createElement('a')
        a.href = `/api/audits/${auditId}/export?format=${format}`
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        return
      }

      // PDF is async: queue → poll → download.
      const queued = await fetch(`/api/audits/${auditId}/export?format=pdf`)
      if (!queued.ok) {
        throw new Error(`Failed to queue PDF (${queued.status})`)
      }
      const { jobId } = (await queued.json()) as { jobId: string }

      // Poll up to ~60s. PDFs typically finish in 1-3s.
      const startedAt = Date.now()
      const timeoutMs = 60_000
      while (true) {
        await new Promise((r) => setTimeout(r, 800))
        const status = await fetch(`/api/exports/${jobId}`)
        if (!status.ok) throw new Error(`Status check failed (${status.status})`)
        const body = (await status.json()) as {
          status: 'pending' | 'processing' | 'done' | 'failed'
          error?: string
        }
        if (body.status === 'done') break
        if (body.status === 'failed') {
          throw new Error(body.error ?? 'PDF render failed.')
        }
        if (Date.now() - startedAt > timeoutMs) {
          throw new Error('PDF is taking longer than expected — try again.')
        }
      }

      // Trigger the download from the same job endpoint.
      const a = document.createElement('a')
      a.href = `/api/exports/${jobId}?download=1`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      console.error('[export]', err)
      alert(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setBusyFormat(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="outline" className="gap-1.5" />}
      >
        <Download className="size-3.5" aria-hidden />
        Export
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuGroup>
          {ITEMS.map((item) => {
            const locked = item.pro && !isPro
            const busy = busyFormat === item.format
            const content = (
              <div className="flex w-full items-center gap-3">
                <item.Icon
                  className={`size-4 shrink-0 ${locked ? 'opacity-40' : 'opacity-80'}`}
                  aria-hidden
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium ${locked ? 'opacity-60' : ''}`}>
                      {item.label}
                    </span>
                    {item.pro ? (
                      <span
                        className={`rounded px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                          locked
                            ? 'border border-border/60 text-muted-foreground'
                            : 'border border-primary/40 bg-primary/10 text-primary'
                        }`}
                      >
                        Pro
                      </span>
                    ) : null}
                    {locked ? <Lock className="size-3 opacity-50" aria-hidden /> : null}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                </div>
                {busy ? (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {item.format === 'pdf' ? 'rendering' : '…'}
                  </span>
                ) : null}
              </div>
            )

            if (locked) {
              return (
                <DropdownMenuItem
                  key={item.format}
                  render={<Link href="/billing" />}
                  className="gap-3 py-2"
                >
                  {content}
                </DropdownMenuItem>
              )
            }

            return (
              <DropdownMenuItem
                key={item.format}
                onClick={() => handleDownload(item.format)}
                disabled={busy}
                className="gap-3 py-2"
              >
                {content}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        {!isPro ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
              <Link
                href="/billing"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Upgrade to Pro
              </Link>{' '}
              to unlock branded PDF reports.
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
