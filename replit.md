# ZappWeb Workspace

## Overview

ZappWeb is a mobile-first website builder for operators who walk into businesses and generate a 5-page professional site in under 5 minutes. Built as a pnpm monorepo with TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (api-server artifact, port 8080, path /api)
- **Frontend**: React + Vite + Tailwind (zappweb artifact, path /)
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (contract-first, from OpenAPI spec)
- **Auth**: bcryptjs + express-session + connect-pg-simple
- **Billing**: Stripe (demo/live/pro tiers)
- **Email**: Mailjet (contact forms)
- **AI**: OpenAI (content generation)
- **Storage**: Google Cloud Storage (business photos)
- **Places**: Google Places API (business auto-fill)

## Architecture

### Artifacts
- `artifacts/api-server` — Express 5 REST API (`/api/*`)
- `artifacts/zappweb` — React + Vite frontend (`/`)

### Libraries
- `lib/db` — Drizzle schema + Neon pool (`@workspace/db`)
- `lib/api-spec` — OpenAPI spec + Orval codegen (`@workspace/api-spec`)
- `lib/api-zod` — Generated Zod validators (`@workspace/api-zod`)
- `lib/api-client-react` — Generated TanStack Query hooks (`@workspace/api-client-react`)

### Database Schema
- `sitesTable` — multi-tenant site record with all business data, theme, tier, session etc.

### URL Structure
- `/` — ZappWeb builder (theme selection)
- `/build/:themeId` — Site builder form (Google Places + form fields)
- `/s/:slug` — Rendered tenant site (public, 3 themes)
- `/s/:slug/preview` — Post-creation preview for operator
- `/s/:slug/login` — Tenant admin login
- `/s/:slug/admin` — Tenant CMS dashboard (edit content, billing, AI)
- `/admin` — Master admin dashboard (all tenants, stats, tier management)

### Themes
1. **Luminary** — light, minimal, clean (`/build/luminary`)
2. **Obsidian** — dark, cinematic, premium (`/build/obsidian`)
3. **Haven** — warm, organic, neighbourhood (`/build/haven`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes to Neon (dev only)
- `pnpm --filter @workspace/api-server run typecheck` — typecheck API server only
- `pnpm --filter @workspace/zappweb run typecheck` — typecheck frontend only

## Secrets Required (not yet set — app degrades gracefully)

| Secret | Used for |
|--------|----------|
| `SESSION_SECRET` | Express session signing (set) |
| `GOOGLE_PLACES_API_KEY` | Google Places business search/details |
| `OPENAI_API_KEY` | AI content generation |
| `MAILJET_API_KEY` / `MAILJET_API_SECRET` | Contact form emails |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |
| `GCS_BUCKET_NAME` / `GCS_CREDENTIALS_JSON` | Business photo storage |

## Important Notes

- `lib/api-zod/src/index.ts` must only export `./generated/api` (not `./generated/types`) — avoids TS2308
- Zod schema for admin tier update is `SetTenantTierBody` (not `SetTierBody`)
- `useTenantLogout.mutateAsync()` takes no arguments (void mutation)
- API routes: admin at `/api/admin/*`, tenant auth at `/api/auth/*`, sites at `/api/sites/*`
- The `sitesTable.placeId` is the Google Place ID (also used as URL slug fallback)
- Sessions use `connect-pg-simple` with `user_sessions` table (auto-created)
