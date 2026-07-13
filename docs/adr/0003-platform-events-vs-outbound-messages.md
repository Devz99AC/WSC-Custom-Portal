# ADR-0003: Realtime SF→Portal — Pub/Sub API + Platform Events/CDC vs Outbound Messages

- **Status:** Accepted
- **Date:** 2026-07-13
- **Deciders:** Platform Engineering
- **Related:** ROADMAP Pillar 1 (realtime), 2.7; docs/ARCHITECTURE-AND-ROADMAP.md §1.5; docs/ARCHITECTURE.md §4.2

## Context

The portal must reflect Salesforce changes (order-status advance, payment verified, new
document, advisor reply) in near-real-time, and must invalidate the catalog cache when a
`Shelf_Corp__c` status changes. Long-polling is explicitly disallowed by requirements.
Options for the SF→BFF channel:

1. **Pub/Sub API (gRPC)** carrying **Platform Events** + **Change Data Capture (CDC)** — the
   modern, durable replacement for CometD streaming, with **replay IDs** for resume.
2. **Outbound Messages (SOAP)** — legacy, no-code, workflow-triggered HTTP callouts to a BFF
   endpoint; simple but limited and without replay semantics.

Forces: durability across BFF restarts (replay), one subscription fanned out to many SSE
clients (not one per client), and cache invalidation driven by record-change events.

## Decision

**Use the Pub/Sub API (gRPC) with Platform Events and CDC as the primary channel.** The BFF
holds **one** persistent subscription, fans out to browsers via **SSE** filtered by
`Contact.Id`, and uses `Shelf_Corp__cChangeEvent` (CDC) to invalidate the Redis catalog
cache. Reconnect uses the stored **replay ID**. **Outbound Messages** are kept as a
documented **MVP fallback** (`Flow → Outbound Message → POST /webhooks/sf`) for teams that
need a no-code start before the gRPC consumer is built.

## Consequences

- **Positive:** durable, resumable event stream; one SF subscription regardless of client
  count; event-driven cache invalidation keeps SF API usage down (risk R2); future-proof vs
  retiring CometD.
- **Negative / cost:** running a persistent gRPC consumer (auth, reconnection, replay-id
  bookkeeping) is more work than a SOAP callout; needs the `SF_PUBSUB_ENDPOINT` config and
  connection lifecycle handling.
- **Follow-up:** implement the subscriber + SSE fan-out in Phase 2 (2.7) and CDC-driven
  invalidation in 2.4.
