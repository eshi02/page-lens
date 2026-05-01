import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea'
  },
  toDriver(value: Buffer) {
    return value
  },
})

/**
 * Plan slugs map 1:1 to Dodo Payments products. Pricing is enforced
 * server-side by reading the row, never trusted from the client.
 */
export const planSlug = pgEnum('plan_slug', ['free', 'pro', 'agency'])
// Mirrors Dodo's SubscriptionStatus union exactly so we can store webhook
// payloads verbatim without translation.
export const subscriptionStatus = pgEnum('subscription_status', [
  'pending',
  'active',
  'on_hold',
  'cancelled',
  'failed',
  'expired',
])
export const auditStatus = pgEnum('audit_status', ['pending', 'success', 'failed'])
export const issueSeverity = pgEnum('issue_severity', ['good', 'warning', 'error'])
export const exportJobStatus = pgEnum('export_job_status', [
  'pending',
  'processing',
  'done',
  'failed',
])

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
    dodoCustomerId: text('dodo_customer_id'),
    // 21-day Pro trial ends at this timestamp. Set once at first sign-in
    // and never refreshed — re-signing in doesn't restart the trial.
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
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
  dodoProductId: text('dodo_product_id'),
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
    dodoSubscriptionId: text('dodo_subscription_id'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subscriptions_user_idx').on(t.userId),
    uniqueIndex('subscriptions_dodo_sub_idx').on(t.dodoSubscriptionId),
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

/**
 * Background job rows for async exports (currently PDF only). The
 * route handler creates a row in `pending`, kicks off render via
 * waitUntil, and updates to `done` with `pdf_data` populated. The
 * client polls /api/exports/[id] for status; once `done`, it fetches
 * the bytes.
 */
export const exportJobs = pgTable(
  'export_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    auditId: uuid('audit_id').notNull(),
    format: text('format').notNull(), // 'pdf' for now; room to grow
    status: exportJobStatus('status').notNull().default('pending'),
    pdfData: bytea('pdf_data'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('export_jobs_user_idx').on(t.userId, t.createdAt),
    index('export_jobs_status_idx').on(t.status, t.createdAt),
  ],
)

/**
 * Denormalized per-user issue counters. Updated on every audit insert
 * so the dashboard's "Top recurring issues" card can do a single
 * indexed read instead of pulling and parsing the last 30 audits'
 * JSONB. The trade-off is one extra UPSERT per issue at audit time —
 * trivial vs. the read-side savings.
 */
export const userIssueStats = pgTable(
  'user_issue_stats',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    issueKey: text('issue_key').notNull(),
    errorCount: integer('error_count').notNull().default(0),
    warningCount: integer('warning_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.issueKey] }),
    index('user_issue_stats_user_count_idx').on(t.userId, t.totalCount),
  ],
)

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type Plan = typeof plans.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
export type Audit = typeof audits.$inferSelect
export type ExportJob = typeof exportJobs.$inferSelect
export type UserIssueStat = typeof userIssueStats.$inferSelect
