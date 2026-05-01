import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import type { Plan } from '@/db/schema'
import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getQuotaState } from '@/server/audit/quota'
import { listPlans } from '@/server/billing/plans'
import { openCustomerPortal, startCheckout } from '@/server/actions/billing'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ status?: string }>

type PlanSlug = 'free' | 'pro' | 'agency'

type Tagline = {
  description: string
  recommended?: boolean
}

const TAGLINES: Record<PlanSlug, Tagline> = {
  free: { description: 'Free for everyone' },
  pro: { description: 'For solo founders & freelancers', recommended: true },
  agency: { description: 'For agencies & growing teams' },
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/billing')

  const { status } = await searchParams
  const [plans, quota] = await Promise.all([listPlans(), getQuotaState(user.id)])

  const showDevBanner =
    !env.DODO_PAYMENTS_API_KEY && env.NODE_ENV !== 'production'
  const free = plans.find((p) => p.slug === 'free')
  const pro = plans.find((p) => p.slug === 'pro')
  const agency = plans.find((p) => p.slug === 'agency')

  return (
    <main className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] bg-mesh"
      />

      <div className="mx-auto w-full max-w-7xl px-6 py-16">
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Billing · plans
          </p>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Pricing</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            You're on the{' '}
            <strong className="text-foreground capitalize">{quota.plan}</strong> plan
            {quota.trial.active && quota.trial.daysLeft != null
              ? ` — ${quota.trial.daysLeft}d trial remaining (${quota.limit} audits/day).`
              : quota.limit > 0
                ? ` — used ${quota.used} of ${quota.limit} audits ${quota.windowDays === 1 ? 'today' : 'this month'}.`
                : ' — unlimited audits.'}
          </p>
        </div>

        {status === 'success' ? (
          <Banner tone="good">
            Subscription updated. It may take a few seconds to reflect here.
          </Banner>
        ) : null}
        {status === 'cancelled' ? (
          <Banner tone="muted">Checkout cancelled. No changes were made.</Banner>
        ) : null}
        {status === 'setup-pending' ? (
          <Banner tone="muted">
            Checkout is being set up — paid plans go live shortly. Drop us a line at{' '}
            <a
              href="mailto:hello@landingcheck.app"
              className="underline underline-offset-4 hover:text-foreground"
            >
              hello@landingcheck.app
            </a>{' '}
            to upgrade in the meantime.
          </Banner>
        ) : null}

        {showDevBanner ? (
          <Banner tone="warn">
            <strong>Dev note:</strong> Dodo Payments not configured. Set{' '}
            <code className="rounded bg-muted px-1">DODO_PAYMENTS_API_KEY</code> +{' '}
            <code className="rounded bg-muted px-1">DODO_WEBHOOK_SECRET</code>, create products
            in Dodo, back-fill{' '}
            <code className="rounded bg-muted px-1">dodo_product_id</code> on plans. (Hidden in
            production.)
          </Banner>
        ) : null}

        <div className="mt-16 grid divide-y divide-border/40 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <PlanColumn
            plan={free}
            current={quota.plan === 'free'}
            currentLabel={
              quota.trial.active && quota.trial.daysLeft != null
                ? `Trial · ${quota.trial.daysLeft}d left`
                : 'Current plan'
            }
            tagline={TAGLINES.free}
            ctaSlot={
              quota.plan === 'free' ? (
                <CurrentPlanButton />
              ) : (
                <DisabledButton label="Free for everyone" />
              )
            }
          />
          <PlanColumn
            plan={pro}
            current={quota.plan === 'pro'}
            tagline={TAGLINES.pro}
            ctaSlot={
              quota.plan === 'pro' ? (
                <ManageButton />
              ) : (
                <UpgradeButton planSlug="pro" recommended />
              )
            }
          />
          <PlanColumn
            plan={agency}
            current={quota.plan === 'agency'}
            tagline={TAGLINES.agency}
            ctaSlot={
              quota.plan === 'agency' ? (
                <ManageButton />
              ) : (
                <UpgradeButton planSlug="agency" />
              )
            }
          />
        </div>

        <p className="mt-12 max-w-prose text-xs text-muted-foreground">
          Prices in USD. Dodo Payments handles local sales tax, GST, and VAT at checkout
          based on your billing country. Cancel anytime — paid features stay active until
          the end of the period.
        </p>
      </div>
    </main>
  )
}

function PlanColumn({
  plan,
  current,
  currentLabel,
  tagline,
  ctaSlot,
}: {
  plan: Plan | undefined
  current: boolean
  currentLabel?: string
  tagline: Tagline
  ctaSlot: React.ReactNode
}) {
  if (!plan) return null
  const features = (plan.features ?? []) as string[]
  const priceLabel =
    plan.priceCents === 0 ? '$0' : `$${Math.round(plan.priceCents / 100)}`
  const cadenceLabel = plan.priceCents === 0 ? '' : 'per month'
  const isRecommended = !!tagline.recommended

  return (
    <div
      className={`group relative flex min-h-[560px] flex-col px-6 py-8 transition-all duration-300 hover:bg-gradient-to-b hover:from-primary/[0.07] hover:via-primary/[0.03] hover:to-transparent hover:shadow-[inset_0_0_60px_-20px] hover:shadow-primary/15 lg:px-8 lg:py-10 ${
        isRecommended
          ? 'overflow-hidden bg-gradient-to-b from-primary/10 via-primary/5 to-transparent shadow-[inset_0_0_60px_-20px] shadow-primary/20'
          : ''
      }`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-24 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl transition-opacity duration-300 ${
          isRecommended ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
        }`}
      />
      {tagline.recommended ? (
        <span className="absolute right-6 top-8 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary shadow-lg shadow-primary/20 lg:right-8 lg:top-10">
          <span aria-hidden className="size-1 rounded-full bg-primary" />
          Recommended
        </span>
      ) : null}

      <h2 className="text-2xl font-semibold tracking-tight">{plan.name}</h2>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight">{priceLabel}</span>
        {cadenceLabel ? (
          <span className="text-sm text-muted-foreground">{cadenceLabel}</span>
        ) : null}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">{tagline.description}</p>

      {current ? (
        <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
          <span aria-hidden className="size-1 rounded-full bg-emerald-400" />
          {currentLabel ?? 'Current plan'}
        </span>
      ) : null}

      <ul className="mt-8 flex-1 space-y-3 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="text-foreground/85">{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">{ctaSlot}</div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      fill="none"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path
        d="M5 8.2 7 10.2 11 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UpgradeButton({
  planSlug,
  recommended,
  disabled,
}: {
  planSlug: 'pro' | 'agency'
  recommended?: boolean
  disabled?: boolean
}) {
  return (
    <form action={startCheckout} className="contents">
      <input type="hidden" name="plan" value={planSlug} />
      <Button
        type="submit"
        size="lg"
        variant={recommended ? 'default' : 'outline'}
        className="w-full"
        disabled={disabled}
      >
        Get started
      </Button>
    </form>
  )
}

function ManageButton() {
  return (
    <form action={openCustomerPortal} className="contents">
      <Button type="submit" size="lg" variant="outline" className="w-full">
        Manage subscription
      </Button>
    </form>
  )
}

function CurrentPlanButton() {
  return (
    <Button size="lg" variant="outline" className="w-full" disabled>
      Your current plan
    </Button>
  )
}

function DisabledButton({ label }: { label: string }) {
  return (
    <Button size="lg" variant="outline" className="w-full" disabled>
      {label}
    </Button>
  )
}

function Banner({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'good' | 'warn' | 'muted'
}) {
  const cls =
    tone === 'good'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : 'border-border/40 bg-muted/30 text-muted-foreground'
  return (
    <div className={`mt-6 rounded-md border px-4 py-3 text-sm ${cls}`} role="status">
      {children}
    </div>
  )
}
