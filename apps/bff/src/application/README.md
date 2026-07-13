# `application/` — Use-cases (hexagonal)

One class/function per action (e.g. `ReserveShelfCorp`, `VerifyPayment`), depending
only on **ports** (interfaces) such as `ShelfCorpRepository`, `PaymentGateway`,
`DocumentStore`. Concrete adapters live in `infrastructure/` and are injected by the
composition root (`src/main.ts`).

- Depends on: `../domain` only. **Never** imports Salesforce/Stripe/S3 SDKs.
- Enables unit-testing use-cases against in-memory fakes (ROADMAP 2.2).

Empty in Phase 0 — no business logic yet.
