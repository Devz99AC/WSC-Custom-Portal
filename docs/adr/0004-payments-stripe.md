# ADR-0004: Payments — Stripe

- **Status:** ~~Accepted~~ **Superseded by [ADR-0006](0006-post-sale-scope-descope-payments.md)** (2026-07-22 — portal is post-sale; no in-portal payments)
- **Date:** 2026-07-13
- **Deciders:** Platform Engineering
- **Related:** ROADMAP Pillar 2 (checkout), 3.1/3.2; docs/ARCHITECTURE-AND-ROADMAP.md §2.2; docs/ARCHITECTURE.md §1.3C, §4.2

## Context

Clients pay for a shelf corporation in **installments** (deposit + balance, as the
prototype shows: two verified payments + a pending balance). The portal must take card
payments without expanding PCI scope, must reconcile payments back to Salesforce
idempotently, and must tolerate webhook retries without double-recording.

## Decision

**Use Stripe for card payments** via **PaymentIntents**, with the browser talking directly
to **Stripe Elements** so card data never touches the BFF (**PCI SAQ-A**). Payment
confirmation arrives via a **signed Stripe webhook**: the BFF verifies the `Stripe-Signature`,
acks fast, and asynchronously **upserts `Payment__c` on the external id
`Stripe_PaymentIntent_Id__c`** (idempotent) before advancing the order stage. Wire transfers
remain a manual advisor-verified path. Payment is abstracted behind a `PaymentGateway` port
so the provider stays swappable.

## Consequences

- **Positive:** minimal PCI burden (SAQ-A); installments, hosted card UI, and robust webhooks
  out of the box; idempotent upsert prevents duplicate payments on webhook replay (risk R4);
  provider is swappable behind the port.
- **Negative / cost:** we depend on Stripe availability and must run signature verification,
  an async webhook worker with a DLQ, and a nightly Stripe↔`Payment__c` reconciliation to
  catch missed events; money paths require the highest test rigor (D4).
- **Follow-up:** implement Stripe Elements checkout (3.1) and the idempotent webhook →
  `Payment__c` → stage-advance worker (3.2) in Phase 3.
