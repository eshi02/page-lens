# Landingcheck

AI-graded landing page audits in 30 seconds. Paste a URL → get a score and a list of specific, actionable conversion-rate fixes.

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, Turbopack)
- **TypeScript** strict
- **Tailwind CSS v4 + shadcn/ui** (Base UI primitives)
- **Supabase** (Postgres + Auth — magic link + Google OAuth)
- **Drizzle ORM** with `postgres-js` driver
- **Zod** for runtime validation at every boundary
- **Google Gemini** via `@google/generative-ai`
- **Stripe** + Stripe Tax for subscriptions
- **Upstash Redis** for per-user rate limiting
- **Sentry** for error tracking
- **Biome** for lint + format
- **Firebase App Hosting** for production deploy (CDN + Cloud Run under the hood)

## Project status

**Phase 1 — Foundation** ✅
Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui scaffold.
Drizzle schema (`profiles`, `plans`, `subscriptions`, `audits`, `audit_cache`) with enums, indexes, FK cascades. Zod-validated server + public env split. Biome for lint/format. One-command dev (`npm run dev`).

**Phase 2 — Auth** ✅
- Supabase magic-link sign-in with custom email template.
- Google sign-in via Google Identity Services (ID-token flow — **no client secret needed**, just the public client ID).
- Cookie-based SSR session (`@supabase/ssr`); proxy refreshes tokens on every request.
- Protected `(authed)` route group with defense-in-depth check at the layout level.
- Top-bar with avatar dropdown + Sign-out Server Action.
- `ensureProfile()` idempotently creates/updates the `profiles` row on every login.

**Phase 3 — Audit endpoint** _(next)_
Server Action with Zod input + SSRF guard, HTML fetch + extract via cheerio, Gemini call, DB write, **24-hour URL-hash cache** to deduplicate Gemini calls across users, quota enforcement (3 audits / rolling 30 days for Free).

**Phase 4 — Dashboard** Audit list + detail page, downloadable PDF report.

**Phase 5 — Billing** Stripe Checkout, webhook → plan flip in DB, Customer Portal link, Stripe Tax for GST/VAT.

**Phase 6 — Polish** Per-user Upstash rate limiting, Sentry, Playwright E2E, Lighthouse 95+.

## Local development

### Prerequisites

- **Node 22.12+** (this repo pins `22` via `.nvmrc` — run `nvm use` to match)
- **Docker Desktop** (or any Docker engine) — Supabase runs inside Docker
- **Supabase CLI** — installed automatically via `npx`, no global install needed

### One-time setup

```bash
nvm use                      # picks up Node 22 from .nvmrc
npm install                  # install deps
cp .env.example .env.local   # then fill in GEMINI_API_KEY (and any others)
```

After your first `supabase start`, copy the printed **Publishable** and
**Secret** keys into `.env.local` (`SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and the `NEXT_PUBLIC_*` mirror).

### Run everything (one command)

```bash
npm run dev
```

This boots:

| Service           | URL                     | What it is                       |
|-------------------|-------------------------|----------------------------------|
| **Next.js app**   | http://localhost:3000   | The app itself                   |
| Supabase API      | http://127.0.0.1:54321  | Auth, REST, realtime             |
| Supabase Studio   | http://127.0.0.1:54323  | Web UI for the local DB          |
| Mailpit           | http://127.0.0.1:54324  | Magic-link emails land here      |
| Postgres          | 127.0.0.1:54322         | Direct DB access if you want it  |

### Stop everything

```bash
npm run stop          # stops the Supabase Docker containers
# Ctrl+C in the terminal that's running Next.js to stop the dev server
```

### First-time DB setup

If the tables don't exist yet (after `supabase db reset` or on a fresh clone):

```bash
npm run db:migrate    # applies drizzle/*.sql to local Postgres
```

## Scripts

```
npm run dev              # supabase start + next dev (one command does it all)
npm run dev:app          # only the Next.js dev server (assumes Supabase is up)
npm run stop             # stops Supabase containers
npm run build            # production build
npm run start            # serve the production build
npm run typecheck        # tsc --noEmit
npm run lint             # biome lint
npm run format           # biome format --write
npm run check            # biome lint + format + organize imports

npm run supabase:start   # only start Supabase
npm run supabase:stop    # only stop Supabase
npm run supabase:status  # print URLs + keys for the local stack
npm run supabase:reset   # nuke local DB and re-apply all migrations

npm run db:generate      # create a new migration from schema diff
npm run db:migrate       # apply pending migrations
npm run db:push          # push schema directly (only for local dev)
npm run db:studio        # open Drizzle Studio
```

## Pricing

| Plan | Price | Audits / month |
|---|---|---|
| Free | $0 | 3 |
| Pro | $30 | unlimited |
| Agency | $99 | unlimited + saved audit history + PDF export + brand voices + API |

## License

UNLICENSED — proprietary.
