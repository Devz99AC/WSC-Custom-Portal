# CLAUDE.md — AI Context & Engineering Rules (WSC Client Portal)

> This file is the authoritative context for AI coding assistants (Claude Code, Cursor, Copilot) working in this repository.
> It is mirrored to `.cursorrules` and `.github/copilot-instructions.md`. **Edit this file; regenerate the mirrors.**
> Architecture details live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). When code and that doc disagree, fix one and say so — do not silently diverge.

## 0. What this project is
A **post-sale Customer Portal** for **Wholesale Shelf Corporations (WSC)** where a client (e.g. *Marcus Brown / Acme Holdings LLC*) tracks their orders for **aged shelf corporations**: multi-order status, payment history & balance (**read-only** — payments are collected by the sales team, not the portal), documents shared by the team (view/download + **e-sign via Formstack Documents** — never DocuSign/PandaDoc), support (tickets/WhatsApp/chat), a referral program, and a learning center. **Salesforce (SFDC) is the Single Source of Truth.** The backend is a **BFF/API Gateway**; the frontend is a **read-mostly** SPA with narrow write paths only (support tickets, referral submissions, e-sign envelope events). New purchases go through the human Sales rep — **no in-portal checkout, no Stripe** ([ADR-0006](docs/adr/0006-post-sale-scope-descope-payments.md), 2026-07-22).

**Prime directives**
1. **SFDC is authoritative.** Never treat portal/local state as the source of truth for business data. Write to SFDC, then reflect back.
2. **Never hardcode secrets** (§4). No exceptions, not even in tests or examples.
3. **The BFF is the only node with credentials.** The SPA never talks to SFDC/Stripe/storage directly.
4. **Strict typing everywhere.** No `any` on integration boundaries; parse and validate all external I/O.

---

## 0.5 Where the project actually stands — read this before planning any work

**The live checklist is [`docs/execution-roadmap.html`](docs/execution-roadmap.html).** Open it in a browser: the progress bar is computed from the file's own `.step.done` elements, so it can't disagree with its own contents. Every finished step carries a note on what was decided and why.

> 📌 **State as of 2026-08-07: 14/17 — the live portal now reads PRODUCTION Salesforce, not the sandbox.** Live at **`portal.wholesaleshelfcorporations.com`** (Vercel + Railway + Redis). Six sections: **Orders · Payments · Documents · Learning Center · Support · Profile**. Gates: typecheck 4/4, lint clean, build 3/3, 136 tests. Steps 11 (prod discovery) and 12 (prod connection) both closed 2026-08-07; **pagination (originally step 13) was dropped as unrealistic** (see below), so the total is 17, not 18 — the remaining steps were renumbered to stay sequential (old 14→13, 15→14, 16→15, 17→16, 18→17).
>
> 🚀 **PRODUCTION CONNECTION LIVE — Step 12 done 2026-08-07.** The BFF on Railway now authenticates to the **production** Salesforce org (`webapps.my.salesforce.com`) via **OAuth 2.0 JWT Bearer** and serves real client data — verified live (the stakeholder signed in with their own email and saw their real order). Built in prod, do not undo: a dedicated **integration user** (`wsc.integration@wholesaleshelfcorporations.com`, Salesforce Integration license, API-only); an **External Client App** (the new framework — **NOT** a classic Connected App) with the JWT cert uploaded (`Enable JWT Bearer Flow`) and OAuth Policies = `Admin approved users are pre-authorized`; the `WSC_Portal_Read_Only` **permission set deployed via change set and assigned** to that user (that assignment is what makes the user "admin approved" — selecting it in App Policies alone is not enough); and Railway's `PORTAL_DATA_SOURCE=salesforce-jwt` + `SF_LOGIN_URL=https://login.salesforce.com` + `SF_CLIENT_ID` + `SF_INTEGRATION_USERNAME` + `SF_JWT_PRIVATE_KEY` (a Railway secret; `crypto/pem.ts`'s `normalizePem` rebuilds a mangled PEM) + `SF_API_VERSION=v67.0`. **Production volumes** (the step-11 unknown, now known): ~24.3k orders · ~18.3k payments · ~31.9k clients · ~31.4k corps · ~16.5k feature orders **raw** — but the portal-visible universe is far smaller (Brand=WSC + not-Cancelled ≈ **2,643 orders across all clients**). The shared API budget still makes step 13 (Redis cache) worthwhile; **pagination was DROPPED 2026-08-07** — no client has ever bought anywhere near the fixed 50/100 cap, so keyset pagination isn't built (the cap stays only as a safety bound).
>
> ⚠️ **Now that it is live on real data, four things are overdue** and were flagged to the stakeholder: (1) **Vercel Hobby→Pro** — the portal is commercial + public on the corporate domain and the free tier is non-commercial (suspension risk); (2) **the CEO checkpoint (step 14) never happened** — go-live occurred by action, not approval; (3) **Documents renders nothing in production** (Files vs `Attachment`, see below); (4) the **EIN least-privilege trim** — the integration user is now assigned a permset that still grants `EIN__c` read, which the BFF no longer selects. *(The `vercel.json` preview-deploy defect, also from step 12, was closed 2026-08-08 — see below.)*
>
> 🔴 **Removing a DTO field is a BREAKING change for tabs that are already open.** Hit on 2026-08-07 by the stakeholder testing the deploy — **there are no real clients yet, they are the only user**, so this cost nothing and a hard refresh cleared it. It is documented because it will not be free once there are. The SPA and the BFF deploy separately, so a tab left open (or restored with `Ctrl+Shift+T`) runs JavaScript older than the API, its zod schema still requires the dropped field, and `.parse()` throws. Three fixes, all in place — don't undo them when touching `apps/web/src/api/client.ts`:
> - A parse failure now becomes a typed **`OutdatedClientError`**, and `App.tsx` **reloads the tab once** to fetch the new bundle. **The once-per-tab guard (`sessionStorage`) is essential** — without it a genuine server-side payload bug becomes an endless reload loop. The second occurrence falls through to a readable message.
> - The client used `.parse()`, so what actually reached the screen was `ZodError.message`: a JSON dump of internal field paths (`[{"code":"invalid_type","path":["orders",0,"ein"]…}]`). It is `safeParse` now — **never render a raw zod error**.
> - **Every request carries an abort signal (30s).** `fetch` has no default timeout, so a request that never settled left TanStack Query permanently `pending` and the app sat on "Loading your portal…" forever with nothing to break the deadlock.
>
> ⚠️ Also found doing that: the BFF set **no `Cache-Control` on `/api/*` at all**, so Vercel's proxy default applied — `public, max-age=0, must-revalidate` with **no `Vary: Cookie`** on per-client authenticated data. `must-revalidate` is what kept it from biting. Now stated explicitly as `private, no-store` in the `onSend` hook, alongside `nosniff`.
>
> 🔒 **Security pass 2026-08-07** (code review, not a live pentest). Verified sound and worth not undoing: no secret reaches the browser (**zero `VITE_`/`import.meta.env` in the SPA**), session in an `httpOnly` cookie, `verifySessionJwt` pins `algorithms:["HS256"]` (blocks alg-confusion), magic-link tokens are 256-bit and stored **hashed** + single-use, row-level authz on all five endpoints reads identity from the cookie (**the client never sends an email or id to select data**), no account enumeration *(⚠️ **this one was REVERSED 2026-08-08** — the login now tells a visitor whether their email has portal access; a stakeholder UX call, see §1 "Portal access gate")*, Salesforce messages never reach the client, `Content-Disposition` strips CR/LF. Four things were added:
> - **Rate limiting on `/auth/request-link`** — the only pre-auth route. `infrastructure/http/rate-limiter.ts`, in-process fixed window, **3/15min per email** (strict, unspoofable — protects the inbox) and **15/15min per IP** (best-effort quota guard; every call costs one SOQL). It runs **before** the client lookup on purpose, or it becomes the enumeration oracle. **In-process**: more than one Railway replica multiplies the limit — move to the existing `ioredis` if you scale out.
> - **`trustProxy: true`** on Fastify, without which every request shares the proxy's address and the IP rule locks out the world. Trade-off accepted: a forged `X-Forwarded-For` evades its own IP bucket, which is why the email rule is the strict one. **Nothing but rate limiting reads `request.ip`** — keep it that way.
> - **Security headers in `apps/web/vercel.json`**, not helmet on the BFF: the BFF serves only JSON, so CSP/frame headers belong where the HTML is served. ⚠️ **The CSP allows `https://i.ytimg.com` (img) and `https://www.youtube-nocookie.com` (frame) because the Learning Center needs both — tightening it without those silently blanks that section.** `style-src` needs `'unsafe-inline'` for React's `style={{…}}` attributes. The BFF adds only `X-Content-Type-Options: nosniff`, which matters on the download route.
> - **Session 45min → 60min** (`SESSION_TTL_SECONDS`, stakeholder). It is **exported and reused as the cookie's `maxAge`** — they were two separate literals that could drift apart.
>
> - **The cookie's `Secure` flag now follows `APP_BASE_URL`'s scheme, not `NODE_ENV`.** A host can silently be missing `NODE_ENV` and the cookie would ship without `Secure` with no visible symptom; `APP_BASE_URL` cannot be absent or malformed, because the magic link is built from it and a bad value fails the boot. Two tests pin both directions — don't "simplify" it back.
>
> Accepted by the stakeholder, deliberately not fixed: the portal being publicly reachable (see step 15) and the magic-link token appearing in Vercel/Railway access logs (single-use, 15min, logs are private).
>
> 🔴 **Phone links: build them with `whatsAppLink()` / `telLink()` from `@wsc/shared`, never by hand.** Both were wrong on 2026-08-07 and in opposite directions, which is why they now share one private `e164Digits()` normalizer. **`wa.me` takes bare digits with no `+`, so the digits it receives ARE the country code plus the number** — `(720) 598-0685` became `wa.me/7205980685`, read as country code **7, Russia/Kazakhstan**. The link worked, it just opened a chat with a stranger, including on the company's own Support card, and a test had frozen the wrong URL. **`tel:` fails the other way**: RFC 3966 needs the `+`, and without it the digits are a *local* number that won't connect from abroad. Salesforce's phone fields are free text and many records omit the `+1`, so this was data-dependent rather than universal — the sandbox happened to have both shapes. The normalizer adds `1` to a bare 10-digit NANP number, trusts anything with a `+` or 11+ digits, and **returns null instead of guessing**; callers then render the number as plain text. A missing button beats a button that quietly rings the wrong country.
>
> **Fields removed from the order page 2026-08-07** at the stakeholder's request, in two passes: first **EIN issued date**, **credit score** and **funding capacity**; then **the EIN itself**, **Corp #** and **Registered agent**. The "Product purchased" card is now down to entity type, state, incorporated, registration #, D-U-N-S and the two annual-report dates. Every one came off the **DTO, the zod schema and the SOQL**, not just the JSX — hiding a field in the UI leaves it travelling in the JSON where any client can read it in devtools. **The EIN no longer leaves Salesforce at all**, which also collapsed `ORDER_DETAIL_SELECT` (it existed only to keep `EIN__c` out of the list payload) and deleted `formatEin()` and the masked `EinValue` reveal control. Re-adding `EIN__c` is a PII decision, not a formatting one — say it out loud. Same commit: the "Product purchased" card shows **only the company name** (the `{age}-year aged {type}, Credit-Ready package.` blurb repeated two rows of the grid below it), and the **Incorporated** row reads `March 15, 2016 (8 Years Old)` — **the filing date stays**, with the age appended, because age is the product (§3, *Aged Corp*) and this saves the client doing the subtraction. **`Age__c` is fractional** (the sandbox's `Devin LLC`, filed 18 days earlier, reads `0.05`) and is floored, so under a year the row says **`(Less than 1 Year Old)`** — stakeholder's choice on 2026-08-07 over a literal `(0 Years Old)`, which reads like missing data. That wording is only appended when a filing date backs it: `agedYears` also lands on 0 when `Age__c` is empty, and with neither the row shows an em-dash rather than claiming an age the record doesn't support.
>
> 🔓 **HTTP Basic Auth is GONE as of 2026-08-07** — `apps/web/middleware.ts` was deleted on the stakeholder's instruction, so the next deploy is open to anyone with the URL. **Step 16 is ticked because the action happened, NOT because the launch was approved:** its CEO checkpoint never took place, step 14 is still open, and **as of 2026-08-07 the portal reads production** — whoever signs in now reaches **real client data** (see the production-connection note near the top of this section). The step's own advice had been to unset the Vercel vars and *keep* the file (it fails closed, so restoring the vars re-gated the portal in 30s without a deploy); deleting it means re-gating now needs `git show 0cc87d9:apps/web/middleware.ts` and a deploy. Loose end: `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` in Vercel are dead weight. **`@vercel/edge` must STAY** — a new `middleware.ts` uses it again (see the environment-routing note below); the old advice to drop it is void.
>
> **Step 17 (mobile responsiveness + visual polish) closed 2026-08-06**, entirely inside `theme.css` and its existing tokens. Verified in headless Chrome at 375/768/1280 with a per-element horizontal-overflow audit across all eight views (0 overflows in 24 combinations). Three things there worth not undoing: the login input is **16px because anything smaller makes iOS Safari zoom the page** on focus; the five tables become labelled cards below 640px, which overrides `display` and therefore **requires the explicit ARIA roles now in the components**; and the mobile sidebar no longer hides `.side-foot`, which had left a phone user with **no way to sign out**. **The real brand mark landed 2026-08-07** and lives in `apps/web/public/`: `wsc-logo.png` (full lockup, login card), `wsc-logo-letters.png` (favicon) and `wsc-logo-letters-light.png` (**knockout — navy recoloured white, crimson C kept**). The two variants are not redundant: the artwork is navy + crimson, so the navy half is invisible on the navy sidebar. All three are rendered through `apps/web/src/components/WscLogo.tsx` — change it there, not per-page. The magic-link email uses the knockout copy at an absolute URL derived from the link's own origin, with the old text lockup as styled `alt` because mail clients block remote images.
>
> ✅ **RESOLVED 2026-08-07 (kept as the lesson): every plan before 2026-08-06 wrongly treated "go-live" as "remove Basic Auth."** In reality there was a whole migration between the sandbox and real clients — steps 11 (discovery) and 12 (prod connection), **both now done.** Step 11 proved the sandbox was a **same-day copy of prod**, so schema/field API names matched (the `WSC_Portal_Read_Only` change set validated clean in prod on the first try); step 12 stood up the JWT connection. The lesson stands for the next big assumption: **verify against the real target before building on it.**
>
> 🔴 **ANSWERED — production uses Files (`ContentDocument`), not classic `Attachment`.** The sandbox `Attachment` records were seeded by us. **So against production the Documents section renders nothing** — the adapter queries `FROM Attachment` and prod has none. This is the one broken section on the live portal; rewriting the Documents adapter to Files/`ContentDocument` (with `ContentDocumentLink` off `Online_Order__c`, and the "- Signed" title convention seen in prod) is scoped-but-unbuilt work.
>
> **The roadmap was restructured on 2026-08-06** around *path to production* instead of *read vs write* (that axis had done its job — reads are finished). Completed work renumbered 1–10. Redis caching (13) **stopped being premature**: the API budget is shared with everything else the org does. **Pagination was reconsidered and DROPPED on 2026-08-07** — the real portal-visible volume is ~2,643 WSC non-cancelled orders across all clients, so no client comes near the 50/100 cap; the cap stays only as a safety bound, keyset pagination isn't built.
>
> **Step 7 (DNS) closed 2026-08-06.** Magic-link email sends from `noreply@wholesaleshelfcorporations.com` via Resend — **pure noreply, no Reply-To by stakeholder decision**. DNS lives in **Cloudflare**. SendGrid was evaluated and rejected even though the domain is already authenticated there: its suppression lists are account-wide and WSC runs heavy marketing through it, so a client who bounced a campaign would silently never receive their sign-in link. Full rationale in [`docs/dns-runbook.md`](docs/dns-runbook.md) §0.5.
>
> ⚠️ **The domain has a wildcard `*` record**: any invented subdomain resolves, so checking whether a DNS record exists via a public resolver gives false positives. Query the authoritative nameserver (`gina.ns.cloudflare.com`) instead.
>
> **Refer a Friend left the numbered sequence** and moved whole to the deferred write fence (W2) — the stakeholder called off splitting it along the read/write seam: *"let it to the Write phase even if it is a mock up, better to finish the current stuff."* Both halves come back together once Q3 defines the referral rules. **Do not rebuild the read half on its own.**
>
> ✅ **Preview-deploy defect FIXED 2026-08-08** (`4293cea`). `vercel.json` still hardcodes the production Railway URL — it cannot read env vars, that is a Vercel limitation — so **`apps/web/middleware.ts` decides per deployment**, with the rule in `apps/web/src/lib/bff-routing.ts` (unit tested; a middleware can only be exercised by deploying it). **Deliberately asymmetric, don't "simplify" it into one uniform path:**
> - **Production returns `inherit`** and falls through to `vercel.json`'s literal rewrite, exactly as before. A missing or mistyped `BFF_ORIGIN` therefore **cannot take production down**. Confirmed live after deploy: production answers 401, not 503.
> - **Everything else fails closed** — an unconfigured preview gets a **503**, never production's backend. The opposite default is what caused this defect: a preview that works perfectly against production Salesforce is invisible, while a broken preview is fixed in a minute.
>
> Set `BFF_ORIGIN` in Vercel scoped to **Preview** (Railway env `development` → `https://wscbff-development.up.railway.app`) and leave it **unset in Production**. ⚠️ Vercel's own "Development" scope is `vercel dev` on a laptop, **not** previews — a name clash with the Railway environment. ⚠️ **Vercel does not rebuild a commit it already built**, so a branch pointing at the same SHA as production produces no Preview at all; testing the middleware needs a branch with its own commit.
>
> **Open CEO questions — only two left: Q3** (referral rules, and Refer a Friend is parked on it) and **Q4** (chat/AI tool). **Q5** was answered by scope rather than by decision: Support shipped as a contact hub, so nothing is waiting on it unless someone asks for ticket creation (W1). **Q1, Q2 and Q6 are closed** — Q1/Q2 in [`docs/checkpoint-q1-q2.md`](docs/checkpoint-q1-q2.md); **Q6 closed 2026-08-06: `Note` records are NOT shown to clients** — the stakeholder ruled them not relevant. Don't re-propose it: the org has no field separating an internal note from a client-safe one, so displaying them would leak staff commentary.

**Resolved thread (2026-08-07): Credit-Ready features now ship from `WSC_Feature_Order__c`.** The old `Paid_Features_Selected__c` → `ShelfCorp.creditReadyFeatures` path was empty and unrendered; the real home turned out to be a **separate object, `WSC_Feature_Order__c`** (record type = the feature name; ~16.5k records in prod). The Order page now renders a "Credit-ready features" card — only the records that exist, named by record-type + status, never the internal Feature Order #. Built, gates green, committed `17e3d34`, and live-verified against both sandbox and prod. See the OrderPage card + `salesforce-portal-repository.featuresFor()`.

**When you complete a step, update the roadmap file *and* the dated line above, together.** A count that only lives in one of the two is how a later session ends up planning against a state that no longer exists.

⚠️ **`docs/STATUS.md`, `docs/ACTION-PLAN.md` and `docs/NEXT-STEPS.md` are HISTORICAL.** They were accurate on 2026-07-22 and are kept for the rationale trail — why things were decided, what was tried and failed. They are **not** a current-state source, and a week of work landed after them. Where they disagree with the execution roadmap, **the roadmap wins.**

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
- **Idempotent writes:** upsert on **external-id** fields, never blind `create`. The portal's only mutating paths (support tickets, referral submissions — ADR-0006) each carry an idempotency key so retries can't double-write.
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
- **Trash data is filtered on read, never deleted (stakeholder rule, 2026-08-07).** The portal must **never surface** an `Online_Order__c` whose `Status__c` starts with `Cancelled` (the five `Cancelled - *` variants) or an `FU_User__c` with `Status__c = 'Inactive'`. It does **not** delete them in Salesforce — it simply never reads them. Implemented in `salesforce-portal-repository.ts`: the Cancelled filter (`NOT Status__c LIKE 'Cancelled%'`) rides on **every** order/payment/documents read; the Inactive filter (`Status__c != 'Inactive'`) sits on `findClientByEmail` **alone** — the sign-in identity gate — so an Inactive client never gets a magic link, never a session, and never reaches any data read (anti-enumeration preserved). **Null statuses are kept** (a null is neither Cancelled nor Inactive). Frozen by `salesforce-portal-repository.test.ts` — don't drop these filters in a refactor.
- **Portal access gate — a live order is required to sign in (stakeholder rule, 2026-08-08).** A bare `FU_User__c` is **not enough**: the client must own **at least one live order** — a WSC `Online_Order__c` that isn't Cancelled. `findClientByEmail` carries a semi-join — `Id IN (SELECT Client__c FROM Online_Order__c WHERE Brand__c = 'WSC' AND NOT Status__c LIKE 'Cancelled%')` — **next to** the Inactive filter, on the **same single sign-in choke point**, so a client with only Cancelled orders (or none at all) never gets a magic link, never a session, and lands nowhere instead of in an **empty portal**. This was a real symptom: `devinzond@gmail.com`, an FU_User whose only order is `Cancelled - Duplicate Order`, reached a blank portal. **"Not Cancelled" IS the bar** the stakeholder set — `To Verify Payment` (the first live pipeline stage) and every later stage (`Pending Balance`, `Verified - *`, `ON HOLD - *`) clear it — so the gate reuses the same Cancelled test rather than an enumerated status allow-list, which the record-type-filtered picklist makes fragile. In prod this admits **2,237** clients (those with ≥1 live WSC order). Also frozen by `salesforce-portal-repository.test.ts`.
  - **The login screen now SAYS so (stakeholder, 2026-08-08) — a deliberate reversal of anti-enumeration.** A denied email gets *"We couldn't sign you in — this email isn't linked to an active order"* instead of the old generic *"if it's on file, a link is on its way."* The response now **differs by account existence**, so a stranger can probe emails to learn who is a WSC client — an accepted trade for clearer UX. Consequences, kept on purpose: the **`/auth/request-link` rate limiter is now the main brake on enumeration** (don't loosen it), and denials are logged server-side with a **redacted** email (`redactEmail`, `de***@gmail.com`). Spread across `request-magic-link.ts` (returns a boolean), `server.ts` (`REQUEST_LINK_GRANTED`/`REQUEST_LINK_DENIED`), `client.ts` (returns `"sent" | "denied"`) and `Login.tsx` (the "denied" card). Frozen by `server.test.ts` + `client.test.ts`. **Don't restore the uniform response** thinking it's a regression — it isn't.

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
| **Advisor** | WSC staff member assigned to guide the client's order (e.g. *Scott Benon*). | `advisor` / `Assigned_Advisor__c`. |
| **Order** | A client's purchase engagement. **Maps to SFDC `Opportunity`** (`OO-####`), not a literal "Order" object. | `Order` DTO ↔ `Opportunity`. |
| **Order Status / Stage** | Real SFDC pipeline: `To Verify Payment → Pending Balance → Verified - Initial Contact → Verified - Work Started → Verified - Waiting to Ship → Verified - Shipped → Verified - Delivered → Verified - Complete` (+ `Cancelled - *`, `ON HOLD - *`). A client-facing **6-step grouping** (Unpaid → Initial Onboarding → Corp docs shipped → Onboarding call → Credit ready setup → Complete/ready for funding) is **pending stakeholder alignment — those steps do not exist in SFDC yet** (ACTION-PLAN Q1/C1). | `orderStage`; resolve labels via mapping table, never hardcode. |
| **Balance Due** | Remaining unpaid amount before the corp ships. | `balanceDue` = `Amount − sum(verified Payments)`. |
| **Verified Payment** | A payment confirmed by the finance/ops team. The portal **displays** payments; it never collects them (ADR-0006). | Real org value: `Online_Payment__c.Status__c = 'Cleared'`. |
| **Support Rep / Implementation Manager** | WSC staff who takes over from the Sales rep **after** purchase (e.g. *Lua*, *Rinki*); shown with direct contact info. | Candidate SFDC field `QC_Agent__c` on `Online_Order__c` — confirm before wiring (ACTION-PLAN Q2/C2). |
| **Supporting Lead (Referral)** | A lead referred by an existing client via **Refer a Friend**; earns a bonus (**$500 per CP match**; **10% of a shelf-corp sale** — rules pending C3). Already modeled in the org. | `Supporting_Lead__c` (→ `SEOX3_Client__c`) + `Supporting_Lead_Allocation__c` / `_Cur__c`. |
| **Learning Center** | Portal section with explainer videos about the client process. | `learningCenter` section/route. |
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
