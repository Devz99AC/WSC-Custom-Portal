# Architecture Decision Records (ADRs)

Each ADR captures one significant decision as **Context / Decision / Consequences**
(see [`0000-template.md`](0000-template.md)). ADRs are immutable once `Accepted`; to
change a decision, add a new ADR that supersedes the old one.

These records ratify decisions already made in [`../../ROADMAP.md`](../../ROADMAP.md)
and [`../ARCHITECTURE-AND-ROADMAP.md`](../ARCHITECTURE-AND-ROADMAP.md) — they are the
contract the rest of the build depends on (ROADMAP task 0.1, depth D3).

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-headless-vs-experience-cloud.md) | Headless BFF vs Experience Cloud | Accepted |
| [0002](0002-s3-vs-salesforce-files.md) | Document storage: S3 vs Salesforce Files | Accepted |
| [0003](0003-platform-events-vs-outbound-messages.md) | Realtime: Pub/Sub API + Platform Events vs Outbound Messages | Accepted |
| [0004](0004-payments-stripe.md) | Payments: Stripe | Superseded by 0006 |
| [0005](0005-customer-identity-magic-link.md) | Customer identity: BFF-native magic-link vs Auth0/Cognito | Accepted |
| [0006](0006-post-sale-scope-descope-payments.md) | Portal scope: post-sale service portal; descope in-portal payments & checkout; e-sign via Formstack | Accepted |

## Open decisions

Pending **stakeholder alignment** (not engineering decisions — see `../ACTION-PLAN.md`
checkpoints): C1 client-facing 6-step pipeline (steps don't exist in SFDC yet), C2 who the
Implementation Manager is in SFDC + where shared documents live, C3 referral bonus rules,
C4 chat/AI tooling choice.
