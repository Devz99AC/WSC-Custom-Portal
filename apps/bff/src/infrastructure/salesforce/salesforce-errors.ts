import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  SalesforceApexError,
  UpstreamMisconfiguredError,
  UpstreamUnavailableError,
  ValidationError,
} from "../../domain/errors.js";
import type { DomainError } from "../../domain/errors.js";

/**
 * Translates Salesforce failures into typed domain errors (CLAUDE.md §1).
 *
 * Two things make this necessary rather than cosmetic:
 *
 * 1. **Salesforce error messages contain the query.** A real `INVALID_FIELD` message is
 *    the full SOQL plus a caret pointing at the offending column. Letting that reach a
 *    client leaks the schema and the shape of our reads — it is exactly what happened in
 *    production on 2026-07-28, when a field missing from the integration user's Permission
 *    Set surfaced as a raw 500 and took the whole app down.
 * 2. **The right response differs per code.** A duplicate rule is a 409, a sharing denial
 *    is a 403, a governor limit is a 429 — collapsing all of them into 500 throws away
 *    information the caller needs.
 */

interface SalesforceErrorDetail {
  errorCode: string;
  message: string;
  fields: string[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const toDetail = (value: unknown): SalesforceErrorDetail | null => {
  const record = asRecord(value);
  const errorCode = asString(record?.errorCode);
  return errorCode
    ? { errorCode, message: asString(record?.message), fields: asStringArray(record?.fields) }
    : null;
};

/**
 * Salesforce reports errors as an ARRAY of `{ errorCode, message, fields[] }` (CLAUDE.md
 * §1). jsforce surfaces a SOQL failure as an `HttpApiError` carrying that array on `.data`
 * while hoisting the first entry's `errorCode`/`message` onto the error itself — verified
 * against the live org, not assumed. Both shapes are read here so the classifier doesn't
 * depend on which one a given call produces.
 */
export function extractSalesforceErrors(error: unknown): SalesforceErrorDetail[] {
  if (Array.isArray(error)) {
    return error.map(toDetail).filter((detail): detail is SalesforceErrorDetail => detail !== null);
  }

  const record = asRecord(error);
  if (!record) {
    return [];
  }

  const fromData = Array.isArray(record.data)
    ? record.data.map(toDetail).filter((detail): detail is SalesforceErrorDetail => detail !== null)
    : [];
  if (fromData.length > 0) {
    return fromData;
  }

  const hoisted = toDetail(record);
  return hoisted ? [hoisted] : [];
}

/**
 * Codes worth retrying *inside* the adapter, because the same call moments later plausibly
 * succeeds.
 *
 * `REQUEST_LIMIT_EXCEEDED` is deliberately NOT here: the org's API budget is measured over
 * 24h, so an immediate retry cannot succeed and only burns more of the budget that just
 * ran out. It becomes a 429 with `Retry-After` so the caller backs off instead.
 */
const RETRYABLE_CODES = new Set(["UNABLE_TO_LOCK_ROW", "SERVER_UNAVAILABLE", "SERVICE_UNAVAILABLE"]);

/** Transport-level failures reaching us as plain `Error`s rather than Salesforce codes. */
const RETRYABLE_SYSTEM_ERRORS = /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed/i;

export function isRetryableSalesforceError(error: unknown): boolean {
  const details = extractSalesforceErrors(error);
  if (details.some((detail) => RETRYABLE_CODES.has(detail.errorCode))) {
    return true;
  }
  // Only treat an unclassified error as transport-level: a Salesforce code that isn't in
  // RETRYABLE_CODES has already been judged non-retryable and must not be retried because
  // its message happens to contain a matching word.
  return details.length === 0 && RETRYABLE_SYSTEM_ERRORS.test(asString(asRecord(error)?.message));
}

/** Client-facing text. Deliberately generic: never Salesforce's own message. */
const GENERIC = {
  validation: "Some of the information submitted was rejected. Please review and try again.",
  conflict: "That record already exists.",
  forbidden: "You don't have access to that record.",
  notFound: "We couldn't find that record.",
  rateLimited: "We're temporarily over our data limit. Please try again in a few minutes.",
  unavailable: "We couldn't reach our records system. Please try again shortly.",
  misconfigured: "We couldn't load this right now. Our team has been notified.",
  apex: "Our records system rejected this request.",
} as const;

/**
 * Maps a Salesforce failure to a typed domain error. The raw Salesforce message is kept
 * only in `detail`, which the error handler logs and never sends to the client.
 */
export function classifySalesforceError(error: unknown): DomainError {
  const details = extractSalesforceErrors(error);
  const primary = details[0];
  const detailText = details.length
    ? details.map((entry) => `${entry.errorCode}: ${entry.message}`).join(" | ")
    : asString(asRecord(error)?.message);

  switch (primary?.errorCode) {
    case "REQUIRED_FIELD_MISSING":
    case "FIELD_CUSTOM_VALIDATION_EXCEPTION":
    case "FIELD_INTEGRITY_EXCEPTION":
    case "INVALID_EMAIL_ADDRESS":
    case "STRING_TOO_LONG":
      return new ValidationError(GENERIC.validation, primary.fields, detailText);

    case "DUPLICATE_VALUE":
    case "DUPLICATES_DETECTED":
      return new ConflictError(GENERIC.conflict, detailText);

    case "INSUFFICIENT_ACCESS":
    case "INSUFFICIENT_ACCESS_OR_READONLY":
    case "INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY":
      return new ForbiddenError(GENERIC.forbidden, detailText);

    case "ENTITY_IS_DELETED":
    case "NOT_FOUND":
      return new NotFoundError(GENERIC.notFound, detailText);

    case "REQUEST_LIMIT_EXCEEDED":
      return new RateLimitedError(GENERIC.rateLimited, 300, detailText);

    // Our own request was wrong — a field the integration user can't see (missing FLS), a
    // renamed field, bad SOQL. Retrying is pointless; an operator has to fix it.
    case "INVALID_FIELD":
    case "INVALID_TYPE":
    case "MALFORMED_QUERY":
    case "INVALID_FIELD_FOR_INSERT_UPDATE":
      return new UpstreamMisconfiguredError(GENERIC.misconfigured, detailText);

    case "APEX_ERROR":
    case "CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY":
      return new SalesforceApexError(primary.errorCode, GENERIC.apex, detailText);

    case "UNABLE_TO_LOCK_ROW":
    case "SERVER_UNAVAILABLE":
    case "SERVICE_UNAVAILABLE":
    case "INVALID_SESSION_ID":
      return new UpstreamUnavailableError(GENERIC.unavailable, detailText);

    default:
      // Unknown Salesforce code, or a transport failure with no code at all. Treated as
      // upstream-unavailable rather than assumed to be the client's fault.
      return new UpstreamUnavailableError(GENERIC.unavailable, detailText);
  }
}
