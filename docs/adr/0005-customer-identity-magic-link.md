# ADR-0005: Customer identity — BFF-native magic-link vs external IdP (Auth0/Cognito)

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Platform Engineering
- **Related:** ROADMAP §1.7/1.8, Appendix A, Appendix C; docs/ARCHITECTURE.md §3.2; ADR-0001 §Consequences (open decision raised there); docs/salesforce-data-model.md

## Context

Two source documents disagree on how the **customer** (not the SF integration user —
that plane was already fixed in ADR-0001) authenticates:

- `ROADMAP.md` assumes an **external IdP**. Appendix A's tech-choice table lists
  "Customer auth | Auth0 / Cognito (magic-link)"; task **1.7** is literally "Configure
  IdP (Auth0 / Cognito / Supabase Auth) with passwordless email magic-link."
- `docs/ARCHITECTURE.md` §3.2 independently specifies a **fully-designed BFF-native
  magic-link** flow: `POST /auth/request-link` emails a single-use, ≤15-minute,
  **hashed** token; `GET /auth/verify?token` exchanges it for a session JWT
  (`httpOnly`, `Secure`, `SameSite=Lax`, signed with rotatable `SESSION_JWT_SECRET` +
  `kid`); the request-link response is **always identical** (anti account-enumeration);
  every request is authorized against the resolved identity (row-level scoping); a
  TOTP step-up is already sketched in the prototype UI ("Two-factor authentication"
  toggle).

ADR-0001 flagged this as an open decision blocking ROADMAP 1.7/1.8 and Phase 4.2
(routing/auth gate). Since then, the real Salesforce org was explored directly
(`docs/salesforce-data-model.md`): the client identity is **not** a standard `Contact`
(as ROADMAP 1.8 assumes — "resolve `email → Contact.Id`") but the custom object
`FU_User__c`, keyed on `E_Mail__c` (PII already encrypted at rest via
`Email_Encrypted__c`). Whichever auth model wins, that resolution target needs
correcting.

**Forces:**
- No other WSC product currently uses Auth0/Cognito/Supabase — adopting one adds a
  new vendor, a recurring cost, and a third-party outage as a new failure mode on
  every login, for zero present reuse.
- The customer base is a simple B2C flow (one buyer per shelf-corp order) — no
  SSO/enterprise federation or social login requirement has been raised.
- The magic-link design in ARCHITECTURE.md §3.2 is already complete down to token
  hashing, TTL, rotation, and anti-enumeration — implementing it is "write the code,"
  not "design it."
- An external IdP would require net-new work with no existing spec: vendor setup, SDK
  integration, and mapping IdP users ↔ `FU_User__c` records.
- `CLAUDE.md` §5.1 and `.env.example` already carry the native option's exact secrets
  shape (`SESSION_JWT_SECRET`, `SESSION_JWT_KID`, `MAGIC_LINK_TTL_SECONDS`); the
  Auth0/Cognito block is explicitly labeled as the "alternative IdP."

## Decision

**Adopt the BFF-native magic-link**, exactly as specified in `docs/ARCHITECTURE.md`
§3.2. No external identity provider.

The design already exists in full and needs no vendor evaluation; WSC has no current
reuse case for an external IdP; it keeps customer auth inside the BFF's existing
security model (same secrets-handling rules, same typed-error middleware) alongside
the SF-side JWT Bearer auth already implemented; and it avoids a recurring vendor cost
and an added external dependency in the login path of a product that only needs
passwordless email, which Auth0/Cognito would not meaningfully simplify over building
it directly.

Auth0/Cognito/Supabase (ROADMAP's original assumption) was considered and rejected:
it would replace an already-fully-designed flow with one requiring net-new
integration work, adds a monthly cost and a third-party outage as a new login-path
failure mode, and its main advantage — SSO, social login, enterprise federation —
answers a requirement nobody has raised for this product.

## Consequences

- **Positive:** ROADMAP 1.7/1.8 collapse into "build what ARCHITECTURE.md §3.2 already
  specifies" — no vendor evaluation, no new design work. One fewer third-party
  dependency and cost line. Auth stays inside the BFF's existing conventions (zod
  boundary validation, typed errors, Redis-backed session/rate-limit state per
  CLAUDE.md §2).
- **Negative / cost:** WSC — not a vendor — now owns token hashing, rate-limiting
  `/auth/request-link` (spam/enumeration defense), email deliverability (bounces,
  spam-folder placement), and session-JWT key rotation. The TOTP step-up already in
  the prototype UI must be built, not inherited from an IdP's MFA.
- **Follow-up:**
  - ROADMAP 1.7 is effectively superseded: implement BFF `/auth/request-link` +
    `/auth/verify` per ARCHITECTURE.md §3.2, instead of configuring an IdP.
  - ROADMAP 1.8's "resolve `email → Contact.Id`" is corrected to
    **`email → FU_User__c.Id`** — the real org has no standard-Contact client
    identity (see `docs/salesforce-data-model.md`).
  - `EMAIL_PROVIDER_API_KEY` (SES/SendGrid/Postmark) becomes a required secret for
    1.7, not optional.
  - Appendix A's "Customer auth | Auth0/Cognito" row and the `.env.example`
    "alternative IdP" block are now a documented **rejected alternative** — kept for
    the record, not implemented.
  - Unblocks Phase 4.2 (routing/auth gate) and the rest of Phase 1's identity work.
