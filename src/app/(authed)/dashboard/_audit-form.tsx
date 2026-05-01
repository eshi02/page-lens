'use client'

import { AlertCircleIcon, RefreshCwIcon, ZapIcon } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { runAuditAction } from '@/server/actions/audit'
import type { RunAuditResult } from '@/server/audit/run-audit'

import { AuditResult } from './_audit-result'

const QUICK_EXAMPLES = ['stripe.com', 'linear.app', 'vercel.com']

type ErrorCode = Exclude<Extract<RunAuditResult, { ok: false }>['code'], undefined>

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; url: string }
  | { kind: 'success'; result: Extract<RunAuditResult, { ok: true }> }
  | { kind: 'error'; message: string; code: ErrorCode; lastUrl: string }

export function AuditForm({
  initialQuotaUsed,
  initialQuotaLimit,
  initialWindowDays,
  prefillUrl,
  trialDaysLeft,
}: {
  initialQuotaUsed: number
  initialQuotaLimit: number
  initialWindowDays: number
  prefillUrl?: string | null
  trialDaysLeft?: number | null
}) {
  const [url, setUrl] = useState(prefillUrl ?? '')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  // Cmd+K (Mac) / Ctrl+K (Win/Linux) focuses the URL input from anywhere
  // on the page. Standard power-user shortcut.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function submit(rawUrl: string) {
    const trimmed = rawUrl.trim()
    if (!trimmed) return

    setState({ kind: 'loading', url: trimmed })
    startTransition(async () => {
      const result = await runAuditAction({ url: trimmed })
      if (!result.ok) {
        setState({ kind: 'error', message: result.error, code: result.code, lastUrl: trimmed })
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
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            inputMode="url"
            placeholder="https://yourapp.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={pending}
            spellCheck="false"
            autoCapitalize="off"
            autoCorrect="off"
            className="h-11 pr-14 text-base"
          />
          {!url ? (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden items-center gap-1 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
              <span>{isMac ? '⌘' : 'Ctrl'}</span>
              <span>K</span>
            </kbd>
          ) : null}
        </div>
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
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Try
        </span>
        {QUICK_EXAMPLES.map((ex) => (
          <button
            type="button"
            key={ex}
            disabled={pending}
            onClick={() => {
              setUrl(ex)
              submit(ex)
            }}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 font-mono text-xs text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/10 hover:text-foreground hover:shadow-primary/20 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="size-1 rounded-full bg-muted-foreground/40 transition-colors group-hover:bg-primary" aria-hidden />
            {ex}
          </button>
        ))}
        <span className="ml-auto text-muted-foreground">
          {initialQuotaLimit < 0
            ? 'Unlimited audits this month'
            : trialDaysLeft != null
              ? `${initialQuotaUsed} / ${initialQuotaLimit} audits today · trial ${trialDaysLeft}d left`
              : `${initialQuotaUsed} / ${initialQuotaLimit} audits used ${initialWindowDays === 1 ? 'today' : 'this month'}`}
        </span>
      </div>

      {state.kind === 'loading' ? <LoadingPanel url={state.url} /> : null}
      {state.kind === 'error' ? (
        <ErrorCard
          message={state.message}
          code={state.code}
          onRetry={() => submit(state.lastUrl)}
          retrying={pending}
        />
      ) : null}
    </div>
  )
}

function ErrorCard({
  message,
  code,
  onRetry,
  retrying,
}: {
  message: string
  code: ErrorCode
  onRetry: () => void
  retrying: boolean
}) {
  const transient = code === 'gemini' || code === 'fetch'
  const Icon = code === 'gemini' ? ZapIcon : AlertCircleIcon
  const tone =
    code === 'gemini'
      ? 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400'
      : 'border-destructive/30 bg-destructive/5 text-destructive'

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm backdrop-blur ${tone}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">{message}</p>
        {transient ? (
          <p className="mt-0.5 text-xs opacity-70">
            This is usually temporary. Retry in a moment.
          </p>
        ) : null}
      </div>
      {transient ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={retrying}
          className="shrink-0 gap-1.5"
        >
          <RefreshCwIcon className={`size-3.5 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying' : 'Retry'}
        </Button>
      ) : null}
    </div>
  )
}

function LoadingPanel({ url }: { url: string }) {
  // Steps walk forward on a timer so the UI feels responsive even though
  // the backend is one big async call. Calibrated to the typical timing
  // (~0.8s fetch, ~0.3s extract, the rest Gemini).
  const [stepIdx, setStepIdx] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setStepIdx(1), 1100)
    const t2 = setTimeout(() => setStepIdx(2), 1700)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const labels = ['Fetching page', 'Extracting content', 'Grading with AI']

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 px-4 py-5 backdrop-blur">
      <div className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Auditing
      </div>
      <div className="mt-1 truncate text-center font-mono text-sm">{url}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {labels.map((label, i) => (
          <Step
            key={label}
            label={label}
            state={i < stepIdx ? 'done' : i === stepIdx ? 'active' : 'pending'}
          />
        ))}
      </div>
    </div>
  )
}

function Step({ label, state }: { label: string; state: 'pending' | 'active' | 'done' }) {
  const dotClass =
    state === 'done'
      ? 'bg-emerald-400'
      : state === 'active'
        ? 'animate-pulse bg-primary shadow-[0_0_10px_2px] shadow-primary/40'
        : 'bg-muted-foreground/30'
  const labelClass = state === 'pending' ? 'text-muted-foreground' : 'text-foreground'
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/60 px-3 py-2 text-sm">
      <span className={`size-2 rounded-full transition-colors ${dotClass}`} aria-hidden />
      <span className={labelClass}>{label}</span>
    </div>
  )
}
