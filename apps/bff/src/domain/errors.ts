/**
 * Typed domain errors (CLAUDE.md §2, ROADMAP §5.2). Everything that can fail throws one
 * of these; the HTTP layer owns the single mapping from `code` to a status and a
 * client-safe body. Nothing below the HTTP boundary decides status codes, and no upstream
 * message is ever handed to the client — `detail` exists for the server log only.
 */
export abstract class DomainError extends Error {
  /** Stable machine-readable code used by the error middleware to map to HTTP. */
  abstract readonly code: string;

  /**
   * Upstream/internal context for the operator: the raw Salesforce message, the failing
   * SOQL, etc. It is logged and **never** serialized into a response — that text routinely
   * contains the query and field names (CLAUDE.md §2: never bubble raw SFDC errors).
   */
  readonly detail: string | undefined;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = new.target.name;
    this.detail = detail;
  }
}

/** A field-level validation failure — Salesforce validation rules / Apex `addError`. */
export class ValidationError extends DomainError {
  readonly code = "VALIDATION";
  readonly fields: readonly string[];

  constructor(message: string, fields: readonly string[] = [], detail?: string) {
    super(message, detail);
    this.fields = fields;
  }
}

/** A duplicate-rule rejection. */
export class ConflictError extends DomainError {
  readonly code = "CONFLICT";
}

/** Sharing or field-level security denied the operation. */
export class ForbiddenError extends DomainError {
  readonly code = "FORBIDDEN";
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";
}

/** Salesforce API/governor limit hit — the caller may retry later. */
export class RateLimitedError extends DomainError {
  readonly code = "RATE_LIMITED";
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds = 60, detail?: string) {
    super(message, detail);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Salesforce is unreachable or failing transiently — retrying later may work. */
export class UpstreamUnavailableError extends DomainError {
  readonly code = "UPSTREAM_UNAVAILABLE";
}

/**
 * The portal asked Salesforce for something Salesforce rejected as malformed — a field
 * the integration user can't see (missing FLS on its Permission Set), a renamed field, a
 * bad SOQL. Distinct from `UpstreamUnavailableError` because **retrying will not help**:
 * it needs an operator change, so it must be loud in the logs and never look transient.
 */
export class UpstreamMisconfiguredError extends DomainError {
  readonly code = "UPSTREAM_MISCONFIGURED";
}

/**
 * An Apex/Flow fault surfaced through the API. Keeps the original Salesforce `errorCode`
 * so the retry classifier can reason about it without re-parsing strings (CLAUDE.md §1).
 */
export class SalesforceApexError extends DomainError {
  readonly code = "SALESFORCE_APEX";
  readonly errorCode: string;

  constructor(errorCode: string, message: string, detail?: string) {
    super(message, detail);
    this.errorCode = errorCode;
  }
}
