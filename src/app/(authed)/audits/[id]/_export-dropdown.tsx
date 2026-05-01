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
      // Drive a real download via a hidden anchor — the route returns
      // the file with a Content-Disposition header so the browser saves
      // it. Using fetch + blob would also work but anchor is simpler
      // and handles auth cookies natively.
      const a = document.createElement('a')
      a.href = `/api/audits/${auditId}/export?format=${format}`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      // Re-enable button after a short delay; the actual download is
      // out of our control once the browser takes over.
      setTimeout(() => setBusyFormat(null), 800)
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
                    …
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
