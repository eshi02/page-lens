'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { runAuditAction } from '@/server/actions/audit'
import type { RunAuditResult } from '@/server/audit/run-audit'

import { AuditResult } from './_audit-result'

const QUICK_EXAMPLES = ['stripe.com', 'linear.app', 'vercel.com']

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; url: string }
  | { kind: 'success'; result: Extract<RunAuditResult, { ok: true }> }
  | { kind: 'error'; message: string }

export function AuditForm({ initialQuotaUsed, initialQuotaLimit }: {
  initialQuotaUsed: number
  initialQuotaLimit: number
}) {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()

  function submit(rawUrl: string) {
    const trimmed = rawUrl.trim()
    if (!trimmed) return

    setState({ kind: 'loading', url: trimmed })
    startTransition(async () => {
      const result = await runAuditAction({ url: trimmed })
      if (!result.ok) {
        setState({ kind: 'error', message: result.error })
        return
      }
      setState({ kind: 'success', result })
    })
  }

  function reset() {
    setState({ kind: 'idle' })
    setUrl('')
  }

  if (state.kind === 'success') {
    return <AuditResult result={state.result} onReset={reset} />
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(url)
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <Input
          type="text"
          inputMode="url"
          placeholder="https://yourapp.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={pending}
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
          className="h-11 flex-1 text-base"
        />
        <Button
          type="submit"
          size="lg"
          disabled={pending || !url.trim()}
          className="h-11 sm:w-auto sm:px-8"
        >
          {pending ? 'Auditing…' : 'Run audit →'}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Try:</span>
        {QUICK_EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex}
            disabled={pending}
            onClick={() => {
              setUrl(ex)
              submit(ex)
            }}
            className="rounded-full border border-border/60 bg-card/40 px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
        <span className="ml-auto text-muted-foreground">
          {initialQuotaLimit < 0
            ? 'Unlimited audits this month'
            : `${initialQuotaUsed} / ${initialQuotaLimit} audits used this month`}
        </span>
      </div>

      {state.kind === 'loading' ? <LoadingPanel url={state.url} /> : null}
      {state.kind === 'error' ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {state.message}
        </div>
      ) : null}
    </div>
  )
}

function LoadingPanel({ url }: { url: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-6">
      <div className="text-center text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Auditing
      </div>
      <div className="mt-1 text-center font-mono text-sm">{url}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Step label="Fetching page" active />
        <Step label="Extracting content" />
        <Step label="Grading with Gemini" />
      </div>
    </div>
  )
}

function Step({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/60 px-3 py-2 text-sm">
      <span
        className={`size-2 rounded-full ${active ? 'animate-pulse bg-primary' : 'bg-muted-foreground/30'}`}
        aria-hidden
      />
      <span className={active ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  )
}
