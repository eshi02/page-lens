import Link from 'next/link'

import { getQuotaState } from '@/server/audit/quota'

/**
 * Compact trial-status pill rendered in the top nav. Only shows for users
 * on a trial. Color shifts as the trial winds down so it nudges without
 * being alarming.
 */
export async function TrialBadge({ userId }: { userId: string }) {
  const { plan, trial } = await getQuotaState(userId)
  if (!trial.active || plan === 'agency') return null

  const days = trial.daysLeft ?? 0
  const tone =
    days <= 1
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
      : days <= 5
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
        : 'border-primary/40 bg-primary/10 text-primary'

  return (
    <Link
      href="/billing"
      className={`hidden items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-80 sm:inline-flex ${tone}`}
      title="View billing — upgrade to keep unlimited access after trial"
    >
      <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-current" />
      Trial · {days}d left
    </Link>
  )
}
