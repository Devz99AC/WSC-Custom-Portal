# ADR-0002: Document storage — AWS S3 (reference in Salesforce) vs Salesforce Files

- **Status:** Accepted
- **Date:** 2026-07-13
- **Deciders:** Platform Engineering
- **Related:** ROADMAP Pillar 2 (document vault), 1.9; docs/ARCHITECTURE-AND-ROADMAP.md §2.3; docs/ARCHITECTURE.md §2.2

## Context

The portal stores legal/financial PDFs (Purchase Agreement, Articles of Incorporation, EIN
letter). Options for the binaries:

1. **Salesforce Files** (`ContentDocument`/`ContentVersion`) — native, but limited/expensive
   storage, download consumes SF API calls and hits REST size limits, and WORM/retention is
   coupled to SF.
2. **AWS S3** — store the binary in a private, encrypted bucket; keep only metadata +
   object key + content hash in a `Document__c` record in Salesforce.

Forces: documents are sensitive PII; some are legal records needing **WORM retention**;
downloads must **not** burn the SF API budget (risk R2); we want strong key control.

## Decision

**Store binaries in AWS S3; store metadata + `S3_Key__c` + `Content_Hash__c` (SHA-256) in
`Document__c`.** Bucket is private, versioned, SSE-KMS encrypted, with **Object Lock
(compliance)** for legal documents. Access is via **short-lived presigned URLs** (≈60s)
issued by the BFF only after it verifies the document belongs to the caller's `Contact.Id`.
Salesforce Files is reserved for small internal advisor attachments, not the client vault.

## Consequences

- **Positive:** effectively unlimited, cheap storage; downloads bypass SF API limits;
  full KMS key control and rotation; native WORM/versioning for compliance; integrity via
  stored hash.
- **Negative / cost:** two systems to keep consistent (S3 object ↔ `Document__c`), requiring
  a reconciliation path; presigned-URL issuance and row-level authz must be implemented
  carefully (risk R3) in Phase 3.
- **Follow-up:** provision the bucket in Phase 1 (1.9); build upload/download with authz in
  Phase 3 (3.5/3.6).
