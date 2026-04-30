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
Bootstrap, design system, schema, env wiring, build pipeline.

**Phase 2 — Auth** _(next)_
Supabase magic link + Google OAuth, protected layout, sign-out.

**Phase 3 — Audit endpoint** Server Action with SSRF guard, Gemini call, DB write, quota enforcement.

**Phase 4 — Dashboard** Audit history, audit detail page.

**Phase 5 — Billing** Stripe checkout, webhook → plan flip, customer portal.

**Phase 6 — Polish** Rate limiting, audit cache, Sentry, Playwright E2E, Lighthouse 95+.

## Local development

Requires Node 20.19+ or 22.12+.

```bash
# 1. Install deps
npm install

# 2. Copy env template; fill in Gemini key + Supabase local creds
cp .env.example .env.local

# 3. Start Supabase locally (requires the Supabase CLI)
#    https://supabase.com/docs/guides/local-development
supabase start

# 4. Apply migrations
npm run db:push

# 5. Run the app
npm run dev
```

## Scripts

```
npm run dev         # Next.js dev server (Turbopack)
npm run build       # production build
npm run start       # serve the built app
npm run typecheck   # tsc --noEmit
npm run lint        # biome lint
npm run format      # biome format --write
npm run check       # biome lint + format + organize imports

npm run db:generate # create a new migration from schema diff
npm run db:migrate  # apply pending migrations
npm run db:push     # push schema directly (for local dev only)
npm run db:studio   # open Drizzle Studio
```

## Pricing

| Plan | Price | Audits / month |
|---|---|---|
| Free | $0 | 3 |
| Pro | $30 | unlimited |
| Agency | $99 | unlimited + saved audit history + PDF export + brand voices + API |

## License

UNLICENSED — proprietary.
