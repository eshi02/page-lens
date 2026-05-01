import { defineConfig } from 'drizzle-kit'

// Drizzle-kit (migrations + introspection) prefers a *direct* Postgres
// connection — pgbouncer transaction-mode pools don't support DDL or
// session-level features. Use DIRECT_URL when set, fall back to
// DATABASE_URL for local dev where they're the same.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  throw new Error('DIRECT_URL (or DATABASE_URL fallback) is required to run Drizzle Kit commands')
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
  verbose: true,
  strict: true,
})
