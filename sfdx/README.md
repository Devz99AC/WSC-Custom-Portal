# Salesforce DX — dev sandbox / scratch org setup

> ⛔ **MANUAL, HUMAN-ONLY STEPS — NOT AUTOMATED IN PHASE 0.**
> Creating a Salesforce org, a Connected App, and the integration secrets **must be done
> by a person** with org access. AI assistants / CI **must not** attempt these steps: they
> require org credentials and produce secrets that go to the secrets manager, never to git
> (CLAUDE.md §4). This folder only ships the **project configuration**; the org itself does
> not exist yet.

> ✅ **Status (2026-07-19):** the sandbox is **provisioned and authorized** in the CLI
> (alias `wsc-sandbox`, `sf_admin@utopia6.com.devinzonde`), and a dev BFF already reads it live.
> ⛔ **Connected App creation is BLOCKED by the org** ("contact Salesforce Customer Support") — but
> ✅ **the JWT Bearer flow is proven working via an External Client App** (`WSC Customer - Devin
> Sandbox`): certificate uploaded, JWT Bearer Flow enabled, Permission Set pre-authorization, smoke
> test passed (`sf org login jwt` → alias `wsc-jwt`, status `Connected`). The steps below (1–5) are
> written for the classic Connected App; the same secrets (cert, Consumer Key) now exist via the
> ECA path instead — no admin ticket needed. Still pending: the BFF code doesn't implement this flow
> yet (still uses dev CLI-session reuse), and the smoke test used the admin user, not a least-privilege
> integration user. See [`../docs/STATUS.md`](../docs/STATUS.md) §4 (G2/G3) and
> [`../docs/salesforce-data-model.md`](../docs/salesforce-data-model.md).

This is ROADMAP task **0.6** (D2). Definition of Done: an SFDX project exists that can
deploy/retrieve metadata and a developer can log in. The steps below get you there.

## What Phase 0 already provides (committed)

- `sfdx-project.json` — project + default package dir (`force-app`), API version.
- `config/project-scratch-def.json` — scratch-org shape (Developer edition).
- `.forceignore` — metadata excluded from deploy/retrieve.
- `force-app/main/default/` — empty package dir (metadata arrives in Phase 1).

## Prerequisites (install once, locally)

- Salesforce CLI: `sf` (v2). Verify with `sf --version`.
- A **Dev Hub** org with Scratch Orgs enabled (for the scratch-org path), or credentials
  to an existing **sandbox** (for the sandbox path).

## Path A — Scratch org (recommended for local dev)

```bash
# from this sfdx/ directory
sf org login web --set-default-dev-hub --alias WSC-DevHub          # one-time: authorize Dev Hub
sf org create scratch --definition-file config/project-scratch-def.json \
     --alias wsc-dev --set-default --duration-days 7
sf org open --target-org wsc-dev                                    # a dev can log in  ✅ DoD
# Phase 1 onward:
sf project deploy start --target-org wsc-dev                        # deploy metadata
sf project retrieve start --target-org wsc-dev                      # retrieve metadata
```

## Path B — Sandbox

```bash
sf org login web --alias wsc-sandbox --instance-url https://test.salesforce.com
sf project deploy start --target-org wsc-sandbox
```

## Connected App + JWT Bearer secrets — MANUAL (Phase 1, blocked here)

Do **not** perform these in Phase 0; they belong to ROADMAP 1.4/1.5. Listed so the human
knows what is coming and where the secrets go:

1. Generate an X.509 keypair (`openssl req -x509 -newkey rsa:2048 -nodes ...`). Keep the
   **private key out of git** — it goes to the secrets manager as `SF_JWT_PRIVATE_KEY`.
2. Create a **Connected App** → enable *Use digital signatures*, upload the **public**
   cert. Record the consumer key → `SF_CLIENT_ID` (secrets manager).
3. Create a dedicated **integration user** + a least-privilege **Permission Set** (portal
   objects/fields only) → username → `SF_INTEGRATION_USERNAME`.
4. Pre-authorize: Connected App *Permitted Users = Admin approved users*; assign the
   Permission Set to the integration user.
5. Put every value in the secrets manager and mirror the **names** (not values) into
   `.env.example` / your `.env.local`. **Never commit real values.**

> After these, the BFF's JWT Bearer flow (ROADMAP 1.6) can mint a token. That code does not
> exist yet in Phase 0.
