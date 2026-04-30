import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Plan } from '@/db/schema'
import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getQuotaState } from '@/server/audit/quota'
import { listPlans } from '@/server/billing/plans'
import { openCustomerPortal, startCheckout } from '@/server/actions/billing'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ status?: string }>

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

  const stripeConfigured = Boolean(env.STRIPE_SECRET_KEY)
  const free = plans.find((p) => p.slug === 'free')
  const pro = plans.find((p) => p.slug === 'pro')
  const agency = plans.find((p) => p.slug === 'agency')

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Billing</p>
        <h1 className="text-3xl font-semibold tracking-tight">Plans &amp; subscription</h1>
        <p className="text-sm text-muted-foreground">
          You're on the <strong className="text-foreground capitalize">{quota.plan}</strong> plan
          {quota.limit > 0
            ? ` — used ${quota.used} of ${quota.limit} audits this month.`
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

      {!stripeConfigured ? (
        <Banner tone="warn">
          Stripe is not configured on the server yet — checkout buttons are disabled.
          Add <code className="rounded bg-muted px-1">STRIPE_SECRET_KEY</code> and{' '}
          <code className="rounded bg-muted px-1">STRIPE_WEBHOOK_SECRET</code> to your{' '}
          <code className="rounded bg-muted px-1">.env.local</code>, then create products in your
          Stripe dashboard and back-fill <code className="rounded bg-muted px-1">stripe_price_id</code>{' '}
          on the <code className="rounded bg-muted px-1">plans</code> table.
        </Banner>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <PlanCard plan={free} current={quota.plan === 'free'} ctaSlot={null} />
        <PlanCard
          plan={pro}
          current={quota.plan === 'pro'}
          highlighted
          ctaSlot={
            quota.plan === 'pro' ? (
              <ManageButton />
            ) : (
              <UpgradeButton planSlug="pro" disabled={!stripeConfigured || !pro?.stripePriceId} />
            )
          }
        />
        <PlanCard
          plan={agency}
          current={quota.plan === 'agency'}
          ctaSlot={
            quota.plan === 'agency' ? (
              <ManageButton />
            ) : (
              <UpgradeButton
                planSlug="agency"
                disabled={!stripeConfigured || !agency?.stripePriceId}
              />
            )
          }
        />
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Prices in USD. Stripe Tax adds local sales tax / GST / VAT at checkout based on your
        billing country. Cancel anytime — paid features stay active until the end of the period.
      </p>
    </main>
  )
}

function PlanCard({
  plan,
  current,
  highlighted,
  ctaSlot,
}: {
  plan: Plan | undefined
  current: boolean
  highlighted?: boolean
  ctaSlot: React.ReactNode
}) {
  if (!plan) return null
  const features = (plan.features ?? []) as string[]
  const priceLabel =
    plan.priceCents === 0
      ? 'Free'
      : `$${Math.round(plan.priceCents / 100)}/mo`

  return (
    <Card
      className={
        highlighted
          ? 'border-primary/40 ring-1 ring-primary/20'
          : current
            ? 'border-emerald-500/40'
            : ''
      }
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.name}</CardTitle>
          {current ? (
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-500/30">
              Current
            </span>
          ) : null}
        </div>
        <CardDescription className="pt-1 text-2xl font-semibold tracking-tight text-foreground">
          {priceLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="space-y-2 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {ctaSlot}
      </CardContent>
    </Card>
  )
}

function UpgradeButton({
  planSlug,
  disabled,
}: {
  planSlug: 'pro' | 'agency'
  disabled?: boolean
}) {
  return (
    <form action={startCheckout} className="contents">
      <input type="hidden" name="plan" value={planSlug} />
      <Button type="submit" size="lg" className="w-full" disabled={disabled}>
        {planSlug === 'pro' ? 'Upgrade to Pro' : 'Upgrade to Agency'}
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
