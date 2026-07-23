# ADR-0006: Portal scope — post-sale service portal; descope in-portal payments & checkout; e-signature via Formstack

- **Status:** Accepted
- **Date:** 2026-07-22
- **Deciders:** WSC stakeholder (product owner) · Platform Engineering
- **Supersedes:** [ADR-0004](0004-payments-stripe.md) (Payments: Stripe)
- **Related:** stakeholder portal review 2026-07-22 (summarized in `docs/ACTION-PLAN.md`); ROADMAP re-scope banner; fases P1–P6

## Context

The stakeholder reviewed the deployed portal (2026-07-22) and defined the **final product
scope**. The portal is a **post-sale service portal**: a client tracks their (multiple)
orders, sees payment history and balance, receives documents, gets support, refers new
leads, and learns about the process. **New purchases go through the human Sales rep** —
there is no self-service buying. The stakeholder additionally prefers already-paid,
integrated services over new per-month tools.

The original architecture (ADR-0004, ROADMAP Phases 2–3) assumed a self-service commerce
flow: catalog → atomic reservation → Stripe checkout → e-signature → client document
upload. None of that appears in the stakeholder's final scope.

## Decision

**Descope from the portal:**
- **Stripe / in-portal payments** (ROADMAP 3.1–3.3) — supersedes ADR-0004. The *Payments*
  section becomes **read-only**: history + balance from `Online_Payment__c`, no pay button.
- **Atomic reservation + TTL sweeper** (2.5–2.6) — the anti-double-sale invariant belonged
  to the self-service checkout; without a buy flow it leaves portal scope (it remains the
  sales team's concern inside Salesforce).
- **Client document upload / S3 upload vault** (3.5) — *Documents* is **view/download (+ sign)**,
  never client-upload. Whether downloads need S3 at all depends on where documents
  actually live in the org (likely Salesforce Files — pending discovery, checkpoint C2).

**E-signature STAYS in scope** (stakeholder amendment, same day) **with a provider change:
Formstack Documents** — per the already-paid-tools rule — instead of DocuSign/PandaDoc,
**conditional on** verifying that WSC's Formstack subscription covers signing (Formstack
Sign / e-sign delivery). Note: **no Formstack package is installed in the org** (verified
2026-07-22 via Tooling API `InstalledSubscriberPackage`), so the integration would go
through Formstack's own API from the BFF, not an SF package. The `IESignProvider` port
makes this an adapter swap, not a redesign.

**Keep / add:** multi-order structure, 7-section navigation (Orders · Payments · Documents ·
Profile · Support · Refer a Friend · Learning Center), staff handoff display (Sales rep →
Implementation Manager), multichannel support (tickets, WhatsApp, AI/live chat — note the
org already has **LiveChat-Salesforce Integration** and **TwilioSalesforce** packages
installed, prime "already-paid" candidates), referral program (mapped to the org's existing
`Supporting_Lead_*` model), Learning Center. The BFF keeps **narrow write paths only**
(support tickets, referral submissions, e-sign envelope events); everything else stays
read-only.

## Consequences

- **Positive:** PCI scope disappears entirely (not even SAQ-A); the highest-risk code paths
  (money movement, client uploads) are gone; signing remains but through already-paid
  tooling behind a port; the integration user stays read-only except a few auditable write
  objects; smaller attack surface and test burden; the plan matches what the business
  actually asked for.
- **Negative / cost:** ADR-0004's design work is parked (not lost — the ADR remains as
  reference if in-portal payments ever return); the "atomic reservation" D4 design is
  removed from portal scope; ROADMAP Phases 2–4 need a v2 rewrite (pending the boss
  discussions: pipeline steps C1, staff/documents C2, referral rules C3, chat tooling C4).
- **Follow-up:** verify the Formstack subscription covers e-sign and which documents get
  signed (checkpoint C2/Q5); execute fases P1–P6 (`docs/ACTION-PLAN.md`); write ROADMAP v2
  after checkpoints C1–C4; revisit this ADR only if the business asks for self-service
  purchase.
