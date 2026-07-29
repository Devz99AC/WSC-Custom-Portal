import { describe, expect, it } from "vitest";
import { classifySalesforceError, isRetryableSalesforceError } from "./salesforce-errors.js";
import {
  ConflictError,
  ForbiddenError,
  RateLimitedError,
  SalesforceApexError,
  UpstreamMisconfiguredError,
  UpstreamUnavailableError,
  ValidationError,
} from "../../domain/errors.js";

/**
 * The `INVALID_FIELD` shape below is the REAL one jsforce produced against the sandbox
 * (an `HttpApiError` whose message is the full SOQL plus a caret) — captured, not invented.
 * This is the exact failure that took production down on 2026-07-28.
 */
const invalidField = Object.assign(new Error(), {
  name: "INVALID_FIELD",
  errorCode: "INVALID_FIELD",
  message:
    "\nSELECT Status_Date__c, EIN__c FROM Online_Order__c\n       ^\nERROR at Row:1:Column:8\n" +
    "No such column 'Status_Date__c' on entity 'Online_Order__c'.",
});

/** Salesforce's documented DML shape: an ARRAY of {errorCode, message, fields}. */
const duplicateArray = [
  { errorCode: "DUPLICATE_VALUE", message: "duplicate value found", fields: ["E_Mail__c"] },
];

describe("classifySalesforceError", () => {
  it("never lets a Salesforce message reach the client", () => {
    const classified = classifySalesforceError(invalidField);

    expect(classified.message).not.toContain("SELECT");
    expect(classified.message).not.toContain("Online_Order__c");
    expect(classified.message).not.toContain("Status_Date__c");
    // …while keeping the whole thing for the operator's log.
    expect(classified.detail).toContain("No such column 'Status_Date__c'");
  });

  it("treats a field the integration user can't see as OUR misconfiguration, not a transient blip", () => {
    expect(classifySalesforceError(invalidField)).toBeInstanceOf(UpstreamMisconfiguredError);
    // Retrying cannot fix a missing Permission Set entry.
    expect(isRetryableSalesforceError(invalidField)).toBe(false);
  });

  it("reads the array shape Salesforce actually returns, including field names", () => {
    const classified = classifySalesforceError(duplicateArray);
    expect(classified).toBeInstanceOf(ConflictError);
  });

  it("surfaces validation failures with the offending fields", () => {
    const classified = classifySalesforceError([
      { errorCode: "FIELD_CUSTOM_VALIDATION_EXCEPTION", message: "Deletion is prohibited", fields: ["Name"] },
    ]);
    expect(classified).toBeInstanceOf(ValidationError);
    expect((classified as ValidationError).fields).toEqual(["Name"]);
  });

  it("maps sharing/FLS denials to forbidden rather than a generic failure", () => {
    expect(
      classifySalesforceError([{ errorCode: "INSUFFICIENT_ACCESS_OR_READONLY", message: "no access", fields: [] }]),
    ).toBeInstanceOf(ForbiddenError);
  });

  it("keeps the original errorCode on Apex faults for the retry classifier", () => {
    const classified = classifySalesforceError([
      { errorCode: "APEX_ERROR", message: "System.DmlException", fields: [] },
    ]);
    expect(classified).toBeInstanceOf(SalesforceApexError);
    expect((classified as SalesforceApexError).errorCode).toBe("APEX_ERROR");
  });

  it("falls back to upstream-unavailable for an unknown code instead of blaming the caller", () => {
    const classified = classifySalesforceError([
      { errorCode: "SOME_FUTURE_CODE", message: "who knows", fields: [] },
    ]);
    expect(classified).toBeInstanceOf(UpstreamUnavailableError);
  });
});

describe("isRetryableSalesforceError", () => {
  it("retries row-lock contention", () => {
    expect(
      isRetryableSalesforceError([{ errorCode: "UNABLE_TO_LOCK_ROW", message: "locked", fields: [] }]),
    ).toBe(true);
  });

  it("does NOT retry a governor-limit hit — an immediate retry burns the budget that just ran out", () => {
    const limit = [{ errorCode: "REQUEST_LIMIT_EXCEEDED", message: "limit exceeded", fields: [] }];
    expect(isRetryableSalesforceError(limit)).toBe(false);

    const classified = classifySalesforceError(limit);
    expect(classified).toBeInstanceOf(RateLimitedError);
    expect((classified as RateLimitedError).retryAfterSeconds).toBeGreaterThan(0);
  });

  it("retries transport failures that carry no Salesforce code at all", () => {
    expect(isRetryableSalesforceError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableSalesforceError(new Error("connect ETIMEDOUT 1.2.3.4:443"))).toBe(true);
  });

  it("does not retry a classified error just because its message mentions a transient word", () => {
    // A real Salesforce code was returned, so the verdict is the code's — not the prose's.
    expect(
      isRetryableSalesforceError([
        { errorCode: "INVALID_FIELD", message: "No such column 'fetch failed'", fields: [] },
      ]),
    ).toBe(false);
  });
});
