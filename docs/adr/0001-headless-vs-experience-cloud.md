# ADR-0001: Headless BFF vs Salesforce Experience Cloud

- **Status:** Accepted
- **Date:** 2026-07-13
- **Deciders:** Platform Engineering
- **Related:** ROADMAP §1 (target architecture), §Appendix A; docs/ARCHITECTURE-AND-ROADMAP.md §1.4; docs/ARCHITECTURE.md §1, §3

## Context

WSC needs a customer portal on top of Salesforce (the SSOT). Two delivery models exist:

1. **Experience Cloud (Community)** — build the portal inside Salesforce (LWR/Aura); SF
   manages login/MFA and hosts the UI.
2. **Headless BFF + SPA** — a custom React SPA talking to a Node/TypeScript
   Backend-for-Frontend, which is the only node holding Salesforce credentials.

Forces: a high-fidelity **design prototype already exists** (bespoke UI, navy/red/gold);
customers should **not** consume Salesforce user licenses; the read-heavy catalog risks
**SF API-limit exhaustion** without a caching layer we control; the team wants one
full-stack TypeScript language and low vendor lock-in.

## Decision

**Adopt the Headless BFF + SPA model.** The SPA (React+TS) talks only to the BFF
(Node+TS, hexagonal). The BFF authenticates to Salesforce server-to-server via **OAuth 2.0
JWT Bearer** with a single integration user, and enforces per-customer (row-level) authz.

Experience Cloud was rejected because it would force a UI rewrite inside Salesforce,
incur per-member Community license cost, and give us less control over API-limit
mitigation and caching.

## Consequences

- **Positive:** reuse the prototype directly; zero customer SF licenses; full control of
  caching/rate-limiting to protect API limits; swappable third parties behind ports;
  low lock-in; testable without a live org.
- **Negative / cost:** we own more infrastructure (the BFF, its auth, its deploy) and must
  build two identity planes and never leak the SF token to the browser (see risk R5).
- **Follow-up (Phase 1):** stand up the JWT Bearer flow (Connected App, integration user,
  least-privilege permission set).
- **Open decision:** the **customer** identity mechanism is unresolved — ROADMAP Appendix C
  assumes an external IdP (Auth0/Cognito) while docs/ARCHITECTURE.md §3.2 assumes a
  BFF-native magic-link. A follow-up ADR must pick one before Phase 1 auth work. This ADR
  only fixes the *server↔Salesforce* plane and the headless topology.
