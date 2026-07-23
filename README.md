# WSC Customer Portal

**Post-sale** customer portal for **Wholesale Shelf Corporations (WSC)**. Clients track their
orders for aged shelf corporations: multi-order status, payment history & balance (read-only —
payments are collected by the sales team), documents shared by the team (view/download +
e-sign via **Formstack Documents**), support, a referral program, and a learning center
([ADR-0006](docs/adr/0006-post-sale-scope-descope-payments.md) — no in-portal checkout/Stripe).
**Salesforce is the single source of truth (SSOT);** this repo is a **headless BFF + SPA** in
front of it. See [`CLAUDE.md`](CLAUDE.md), [`ROADMAP.md`](ROADMAP.md), and
[`docs/`](docs/) for the authoritative architecture and plan.

> **Status (2026-07-22):** live in **staging/production** — frontend on Vercel
> (`wsc-custom-portal-web.vercel.app`, behind HTTP Basic Auth), BFF on Railway with Redis, real
> **magic-link login** (ADR-0005) and **`PORTAL_DATA_SOURCE=salesforce-jwt`** reading real
> Salesforce data through a least-privilege integration user. Adapters: `mock` (default, sample
> data), `salesforce` (dev, reuses the `sf` CLI session), `salesforce-jwt` (OAuth 2.0 JWT Bearer).
> **👉 Current state: [`docs/STATUS.md`](docs/STATUS.md). Plan (post-stakeholder-feedback, fases
> P1–P6): [`docs/ACTION-PLAN.md`](docs/ACTION-PLAN.md).**

## Monorepo layout

```
apps/web        React + TypeScript + Vite SPA (boots; ports the prototype in Phase 4)
apps/bff        Node + Fastify + TypeScript BFF, hexagonal (domain/application/infrastructure)
packages/shared Domain types + zod schemas shared by web and bff (@wsc/shared)
sfdx/           Salesforce DX project config (org creation is a manual step — see sfdx/README.md)
docs/adr/       Architecture Decision Records
```

## Prerequisites

- **Node.js 24** (`.nvmrc` pins 24 — required by `@jsforce/jsforce-node`'s bundled undici). **pnpm 9** (`corepack enable`).

## Getting started

```bash
corepack enable          # provides pnpm from the version pinned in package.json
pnpm install
pnpm build               # turbo: build shared → bff → web
pnpm dev                 # runs web (5173) and bff (8080) in parallel
```

Then open **http://localhost:5173** and sign in with `m.brown@acmeholdings.com` (demo). To read
**live Salesforce** instead of mock data, set `PORTAL_DATA_SOURCE=salesforce` and
`SF_TARGET_USERNAME=<your org user>` before starting the BFF — see [`docs/STATUS.md`](docs/STATUS.md) §2.

## Quality gates (also run in CI)

```bash
pnpm lint                # ESLint (flat config, typescript-eslint)
pnpm typecheck           # tsc --noEmit across all packages (strict)
pnpm test                # Vitest across all packages
pnpm build               # production build of every package
```

## Configuration & secrets

Copy `.env.example` to `.env.local` (git-ignored) and fill values from your secrets manager.
**Never commit real secrets** (CLAUDE.md §4). Variable names are documented in `.env.example`
and `docs/ARCHITECTURE.md` §5.1.

## Salesforce

Creating the sandbox org and the External Client App is a **manual, human-only** step —
runbook in [`docs/salesforce-sandbox-setup.md`](docs/salesforce-sandbox-setup.md). The BFF
connects to the live sandbox via JWT Bearer (`salesforce-jwt`) or the dev CLI session
(`salesforce`); the real data model is documented in
[`docs/salesforce-data-model.md`](docs/salesforce-data-model.md).
