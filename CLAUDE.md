# CLAUDE.md — AI Context & Engineering Rules (WSC Client Portal)

> This file is the authoritative context for AI coding assistants (Claude Code, Cursor, Copilot) working in this repository.
> It is mirrored to `.cursorrules` and `.github/copilot-instructions.md`. **Edit this file; regenerate the mirrors.**
> Architecture details live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). When code and that doc disagree, fix one and say so — do not silently diverge.

## 0. What this project is
A **Customer Portal** for **Wholesale Shelf Corporations (WSC)** where a client (e.g. *Marcus Brown / Acme Holdings LLC*) tracks their purchase of an **aged shelf corporation**, makes payments, signs documents, and follows order status. **Salesforce (SFDC) is the Single Source of Truth.** The backend is a **BFF/API Gateway**; the frontend is a **read-mostly** SPA. Third parties: **Stripe** (payments), **AWS S3 / Azure Blob** (documents), **DocuSign/PandaDoc** (e-sign).

**Prime directives**
1. **SFDC is authoritative.** Never treat portal/local state as the source of truth for business data. Write to SFDC, then reflect back.
2. **Never hardcode secrets** (§4). No exceptions, not even in tests or examples.
3. **The BFF is the only node with credentials.** The SPA never talks to SFDC/Stripe/storage directly.
4. **Strict typing everywhere.** No `any` on integration boundaries; parse and validate all external I/O.

---

## 1. Salesforce integration rules

Build all SFDC access through a single **`SalesforceClient` service** (dependency-injected). No component issues raw HTTP to SFDC.

- **Auth:** OAuth 2.0 **JWT Bearer** flow only (server-to-server). Cache the access token in Redis; refresh proactively (TTL − 60s) and reactively on `401 invalid_session_id`. Never store SFDC username/password or refresh tokens.
- **Prefer Bulk & Composite over row loops.** Any operation touching **>200 records → Bulk API 2.0**. To read a parent + children, use the **Composite / Composite-Graph API** (one round-trip), never N SOQL queries in a loop. **Never** put a SOQL/DML call inside a `for`/`map` iteration.
- **Respect SOQL/API governor limits:**
  - Always `SELECT` explicit fields — never `SELECT *`-style over-fetching.
  - Add `LIMIT` and keyset pagination to every list query; never unbounded selects.
  - Filter on **indexed/external-id** fields; avoid leading-wildcard `LIKE`.
  - Use relationship subqueries to fetch children in one query instead of a second call.
  - Read the `Sforce-Limit-Info` response header and surface remaining API budget; back off toward cache as it nears the limit.
- **Idempotent writes:** upsert on **external-id** fields (e.g. `Payment__c.Stripe_PaymentIntent_Id__c`), never blind `create`. Every mutating call carries an idempotency key so retries can't double-write.
- **Parse SFDC/APEX errors correctly.** SFDC returns an **array** of `{ errorCode, message, fields[] }`. Map them to typed domain errors — do **not** string-match or bubble raw payloads to the client:
  | SFDC `errorCode` | Meaning | Portal response |
  | --- | --- | --- |
  | `REQUIRED_FIELD_MISSING`, `FIELD_CUSTOM_VALIDATION_EXCEPTION` | Validation rule / Apex `addError` | `422` + field-level message |
  | `DUPLICATE_VALUE`, `DUPLICATES_DETECTED` | Duplicate rule | `409` |
  | `INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY`, `INSUFFICIENT_ACCESS_OR_READONLY` | Sharing / FLS | `403` |
  | `REQUEST_LIMIT_EXCEEDED` | API/governor limit | `429` → retry w/ backoff |
  | `UNABLE_TO_LOCK_ROW` | Row lock contention | retry (transient) |
  | `INVALID_SESSION_ID` | Token expired | re-mint JWT, retry once |
  - Apex/Flow can throw custom faults — wrap them in a typed `SalesforceApexError` carrying the original `errorCode` for the retry classifier.
- **Cache reads, invalidate on events.** Read-through Redis cache for shaped DTOs; invalidate on Platform Event / CDC for the affected record. Never serve a stale value after a confirmed SFDC write.
- **Field/stage labels are data, not constants.** Resolve `Opportunity.StageName` and picklist labels through the mapping table in `docs/ARCHITECTURE.md` §2.3; never hardcode display strings in components.

---

## 2. Standard software architecture

**Layering (strict, one-directional dependencies):**
```
routes/controllers  →  services (use-cases)  →  integration adapters (SF, Stripe, storage, esign)
        ↓                     ↓                            ↓
      DTOs             domain models                 external SDKs
```
- **Dependency injection to isolate third parties.** Every external system sits behind an **interface** (`ISalesforceClient`, `IPaymentGateway`, `IDocumentStore`, `IESignProvider`). Business logic depends on the interface, never the vendor SDK. This keeps Stripe/DocuSign/S3 swappable and unit-testable (mock the interface).
- **No vendor types leak upward.** Convert Stripe/DocuSign/SFDC payloads into internal domain models at the adapter boundary. Controllers and use-cases never see a raw `Stripe.PaymentIntent` or SFDC JSON.
- **Centralized error handling.** One error middleware maps typed errors → HTTP status codes. Throw typed errors (`ValidationError`, `NotFoundError`, `UpstreamUnavailableError`, `SalesforceApexError`), never bare strings. Standard responses: `400/401/403/404/409/422/429/5xx`. Never return SFDC/Stripe raw errors to the client.
- **Centralized state.** Server session/cache state in Redis (not in-process). Frontend: a single state layer (e.g. React Query/TanStack Query for server state) — server data is cache, not local truth; refetch/invalidate rather than mutating local copies.
- **Strict typing & validation.** TypeScript `strict: true`. Validate every inbound payload and every external response with a schema (e.g. Zod) at the boundary; types are **derived** from schemas. No `any`, no unchecked casts on I/O.
- **Idempotency & retries live in the adapter/worker layer**, not scattered in controllers. Webhooks: verify signature → ack fast → process async (see `docs/ARCHITECTURE.md` §4).
- **Determinism & testability.** No `Date.now()`/random inside business logic — inject a clock/id generator. Pure use-cases, side effects at the edges.
- **Match the surrounding code.** Follow existing naming, structure, and comment density. Don't introduce a new pattern where one already exists.

---

## 3. Business-domain glossary (naming authority)

Use these exact terms in identifiers, types, and comments. Consistent naming across code and SFDC is mandatory.

| Term | Definition | Naming guidance |
| --- | --- | --- |
| **Shelf Corporation** | A legally formed company created and left inactive ("on the shelf") to accrue age before being sold. | Entity/object `ShelfCorp` ↔ SFDC `Shelf_Corp__c`. |
| **Aged Corp** | A shelf corporation that has accumulated *time-in-business* (age is the value). | `agedYears` / `Time_In_Business__c`. |
| **EIN** | Employer Identification Number — the IRS federal tax ID of the entity. **Sensitive PII.** | `ein` / `EIN__c`; mask in logs & DTOs. |
| **Good Standing** | State-level status confirming the entity is current on filings/fees and legally active. | boolean `isInGoodStanding` / `Good_Standing__c`. |
| **Buyout** | The client's outright purchase/transfer of the shelf corporation. | `buyoutStatus` / `Buyout_Status__c`. |
| **Credit-Ready** | A package pre-configured with credibility/verification features (business address, phone, 411 listing, D-U-N-S, etc.) so the corp can obtain business credit. | `creditReadyFeatures` / `Credit_Ready_Features__c`. |
| **411 Listing** | A directory listing establishing business phone credibility (a credit-ready feature). | `directoryListing411`. |
| **D-U-N-S** | Dun & Bradstreet business identifier used for business credit. | `dunsNumber`. |
| **Entity Type** | Legal form of the corp (e.g. *Wyoming LLC*, C-Corp). | `entityType` / `Entity_Type__c`. |
| **State of Formation** | US state where the entity was formed (e.g. Wyoming). | `stateOfFormation`. |
| **Advisor** | WSC staff member assigned to guide the client's order (e.g. *Rinkie S.*). | `advisor` / `Assigned_Advisor__c`. |
| **Order** | A client's purchase engagement. **Maps to SFDC `Opportunity`** (`OO-####`), not a literal "Order" object. | `Order` DTO ↔ `Opportunity`. |
| **Order Status / Stage** | Pipeline position: `To Verify Payment → Pending Balance → Initial Contact → Work Started → Waiting to Ship → Shipped → Delivered → Complete`. Maps to `Opportunity.StageName`. | `orderStage`; resolve labels via mapping table. |
| **Balance Due** | Remaining unpaid amount before the corp ships. | `balanceDue` = `Amount − sum(verified Payments)`. |
| **Verified Payment** | A payment confirmed (Stripe webhook for card; advisor confirmation for wire). | `Payment__c.Status__c = Verified`. |
| **Articles of Incorporation** | Founding legal document proving entity formation. | Document `Type__c`. |

> When unsure whether "Order" means the SFDC object or the domain concept: **it is an `Opportunity`.** WSC has no standard `Order` object.

---

## 4. Secrets handling — hard rules

- **NEVER hardcode** Salesforce credentials, JWT private keys, Stripe keys, DocuSign keys, storage keys, or session secrets — not in source, config, comments, tests, fixtures, or logs.
- **Read every secret from environment variables** injected from the platform secrets manager (AWS Secrets Manager / Azure Key Vault / Doppler). The canonical variable names are in `docs/ARCHITECTURE.md` §5.1.
- **No secret in git.** If a secret is needed for local dev, use `.env.local` (git-ignored) and provide a **valueless** `.env.example` listing names only.
- **Never print secrets.** Redact tokens/keys/PII (`EIN`, full email/phone) in logs and error messages.
- **Never send secrets to the client.** Only `STRIPE_PUBLISHABLE_KEY` and other explicitly public values may reach the SPA.
- **If you find a hardcoded or committed secret, stop and flag it** — do not "improve" around it. Treat it as an incident, recommend rotation.
- Do not weaken auth (disable signature verification, skip HMAC checks, widen CORS, log tokens "for debugging") to make something work. Fix the real cause.

---

## 5. Do / Don't quick reference

**Do**
- Route all SFDC calls through the injected `SalesforceClient`; use Bulk/Composite; upsert on external ids.
- Verify webhook signatures before processing; make handlers idempotent.
- Return typed errors → mapped HTTP codes; validate all I/O with schemas.
- Cache reads in Redis; invalidate on SFDC events.

**Don't**
- Don't call SFDC/Stripe/storage from the frontend.
- Don't loop SOQL/DML, `SELECT` everything, or run unbounded queries.
- Don't hardcode secrets, stage labels, or vendor types into business logic.
- Don't treat portal state as authoritative over Salesforce.
