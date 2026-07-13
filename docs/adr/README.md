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
| [0004](0004-payments-stripe.md) | Payments: Stripe | Accepted |

## Open decisions (deferred to Phase 1)

- **Customer identity provider.** ROADMAP Appendix C assumes an external IdP
  (Auth0/Cognito); `docs/ARCHITECTURE.md` §3.2 assumes a BFF-native magic-link. To be
  resolved by a new ADR before Phase 1 auth work. Noted in ADR-0001 §Consequences.
