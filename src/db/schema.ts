import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Plan slugs map 1:1 to Stripe Products. Pricing is enforced server-side
 * by reading the row, never trusted from the client.
 */
export const planSlug = pgEnum('plan_slug', ['free', 'pro', 'agency'])
export const subscriptionStatus = pgEnum('subscription_status', [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
])
export const auditStatus = pgEnum('audit_status', ['pending', 'success', 'failed'])
export const issueSeverity = pgEnum('issue_severity', ['good', 'warning', 'error'])

/**
 * profiles.id matches auth.users.id from Supabase Auth.
 * One profile per authenticated user.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    stripeCustomerId: text('stripe_customer_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('profiles_email_idx').on(t.email)],
)

/**
 * plans is seed data; rows are referenced by slug throughout the app.
 * monthlyAuditQuota = -1 means unlimited.
 */
export const plans = pgTable('plans', {
  slug: planSlug('slug').primaryKey(),
  name: text('name').notNull(),
  monthlyAuditQuota: integer('monthly_audit_quota').notNull(),
  priceCents: integer('price_cents').notNull(),
  stripePriceId: text('stripe_price_id'),
  features: jsonb('features').$type<string[]>().notNull().default([]),
})

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    planSlug: planSlug('plan_slug')
      .notNull()
      .references(() => plans.slug),
    status: subscriptionStatus('status').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subscriptions_user_idx').on(t.userId),
    uniqueIndex('subscriptions_stripe_sub_idx').on(t.stripeSubscriptionId),
  ],
)

export type AuditIssue = {
  key: string
  severity: 'good' | 'warning' | 'error'
  message: string
}

export const audits = pgTable(
  'audits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    urlHash: text('url_hash').notNull(),
    status: auditStatus('status').notNull().default('pending'),
    score: integer('score'),
    summary: text('summary'),
    issues: jsonb('issues').$type<AuditIssue[]>(),
    errorMessage: text('error_message'),
    cachedFrom: uuid('cached_from'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audits_user_created_idx').on(t.userId, t.createdAt),
    index('audits_url_hash_idx').on(t.urlHash),
  ],
)

/**
 * audit_cache stores the AI result keyed by URL hash for 24h.
 * Two users auditing the same URL within 24h reuse the cached result.
 */
export const auditCache = pgTable(
  'audit_cache',
  {
    urlHash: text('url_hash').primaryKey(),
    url: text('url').notNull(),
    score: integer('score').notNull(),
    summary: text('summary').notNull(),
    issues: jsonb('issues').$type<AuditIssue[]>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_cache_expires_idx').on(t.expiresAt)],
)

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type Plan = typeof plans.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
export type Audit = typeof audits.$inferSelect
