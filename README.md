# WSC Customer Portal

Customer portal for **Wholesale Shelf Corporations (WSC)**. Clients track their purchase of
an aged shelf corporation, make payments, sign documents, and follow order status.
**Salesforce is the single source of truth (SSOT);** this repo is a **headless BFF + SPA** in
front of it. See [`CLAUDE.md`](CLAUDE.md), [`ROADMAP.md`](ROADMAP.md), and
[`docs/`](docs/) for the authoritative architecture and plan.

> **Status (2026-07-16):** Phase 0 **done**. Ahead of plan, a **working demo** exists — Login +
> Dashboard (React) served by the BFF, which reads **real Salesforce data** in dev via a read-only
> adapter (`PORTAL_DATA_SOURCE=salesforce`, reusing the `sf` CLI session — no Connected App yet).
> A mock adapter (`PORTAL_DATA_SOURCE=mock`, default) serves identically-shaped sample data.
> **👉 Current state, gaps, and the updated action plan: [`docs/STATUS.md`](docs/STATUS.md).**
> Still open: customer auth decision, production server→SF auth, most of Phases 1–5.

## Monorepo layout

```
apps/web        React + TypeScript + Vite SPA (boots; ports the prototype in Phase 4)
apps/bff        Node + Fastify + TypeScript BFF, hexagonal (domain/application/infrastructure)
packages/shared Domain types + zod schemas shared by web and bff (@wsc/shared)
sfdx/           Salesforce DX project config (org creation is a manual step — see sfdx/README.md)
docs/adr/       Architecture Decision Records
```

## Prerequisites

- **Node.js ≥ 20** (`.nvmrc` pins 20; developed on 24). **pnpm 9** (`corepack enable`).

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

Creating the sandbox/scratch org and the Connected App is a **manual, human-only** step.
Follow [`sfdx/README.md`](sfdx/README.md). Nothing in this repo connects to a live org yet.
