import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";
import { loadEnv } from "../../config/env.js";
import { SESSION_COOKIE_NAME, signSessionJwt } from "../auth/session-jwt.js";
import { GetOrders } from "../../application/get-orders.js";
import { GetOrder } from "../../application/get-order.js";
import { GetPayments } from "../../application/get-payments.js";
import { GetDocuments } from "../../application/get-documents.js";
import { RequestMagicLink } from "../../application/request-magic-link.js";
import { VerifyMagicLink } from "../../application/verify-magic-link.js";
import { InMemoryMagicLinkStore } from "../auth/in-memory-magic-link-store.js";
import { classifySalesforceError } from "../salesforce/salesforce-errors.js";
import type { PortalRepository } from "../../application/ports/portal-repository.js";

const SESSION_CONFIG = { secret: "test-secret-not-a-real-key", kid: "1" };

/** Every read fails the way Salesforce failed in production on 2026-07-28. */
class FailingRepository implements PortalRepository {
  constructor(private readonly failure: unknown) {}

  private fail(): never {
    throw classifySalesforceError(this.failure);
  }

  listOrdersByEmail(): never {
    return this.fail();
  }
  getOrderByEmailAndId(): never {
    return this.fail();
  }
  listPaymentsByEmail(): never {
    return this.fail();
  }
  listDocumentsByEmail(): never {
    return this.fail();
  }
  getDocumentForDownload(): never {
    return this.fail();
  }
  findClientByEmail(): never {
    return this.fail();
  }
}

function buildApp(failure: unknown) {
  const repository = new FailingRepository(failure);
  return buildServer(loadEnv({ LOG_LEVEL: "silent" }), {
    getOrders: new GetOrders(repository),
    getOrder: new GetOrder(repository),
    getPayments: new GetPayments(repository),
    getDocuments: new GetDocuments(repository),
    requestMagicLink: new RequestMagicLink(
      repository,
      new InMemoryMagicLinkStore(),
      () => Promise.resolve(),
      ({ verifyUrl }) => ({ subject: "s", html: verifyUrl, text: verifyUrl }),
      { appBaseUrl: "http://localhost:5173", ttlSeconds: 900 },
    ),
    verifyMagicLink: new VerifyMagicLink(new InMemoryMagicLinkStore()),
    sessionConfig: SESSION_CONFIG,
  });
}

const signedIn = () => ({
  [SESSION_COOKIE_NAME]: signSessionJwt({ sub: "c1", email: "m.brown@acme.com" }, SESSION_CONFIG),
});

/** The exact jsforce error that took production down: its message is the whole SOQL. */
const INVALID_FIELD = Object.assign(new Error(), {
  name: "INVALID_FIELD",
  errorCode: "INVALID_FIELD",
  message:
    "\nSELECT Status_Date__c, EIN__c FROM Online_Order__c WHERE Client__r.E_Mail__c = 'm.brown@acme.com'\n" +
    "       ^\nERROR at Row:1:Column:8\nNo such column 'Status_Date__c' on entity 'Online_Order__c'.",
});

describe("error handling at the HTTP boundary", () => {
  it("never returns Salesforce's message, the SOQL, or field names to the client", async () => {
    const response = await buildApp(INVALID_FIELD).inject({
      method: "GET",
      url: "/api/orders",
      cookies: signedIn(),
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("SELECT");
    expect(response.body).not.toContain("Online_Order__c");
    expect(response.body).not.toContain("Status_Date__c");
    expect(response.body).not.toContain("No such column");
    expect(response.json()).toEqual({
      error: expect.any(String),
      code: "UPSTREAM_MISCONFIGURED",
    });
  });

  it("maps a governor-limit hit to 429 with Retry-After instead of a blanket 500", async () => {
    const response = await buildApp([
      { errorCode: "REQUEST_LIMIT_EXCEEDED", message: "TotalRequests Limit exceeded.", fields: [] },
    ]).inject({ method: "GET", url: "/api/payments", cookies: signedIn() });

    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBeDefined();
    expect(response.body).not.toContain("TotalRequests");
  });

  it("maps a sharing/FLS denial to 403", async () => {
    const response = await buildApp([
      { errorCode: "INSUFFICIENT_ACCESS_OR_READONLY", message: "insufficient access", fields: [] },
    ]).inject({ method: "GET", url: "/api/documents", cookies: signedIn() });

    expect(response.statusCode).toBe(403);
  });

  it("still rejects an unauthenticated caller before any Salesforce call happens", async () => {
    const response = await buildApp(INVALID_FIELD).inject({ method: "GET", url: "/api/orders" });
    expect(response.statusCode).toBe(401);
  });

  it("keeps the magic-link response identical when the lookup itself blows up", async () => {
    // Anti-enumeration outranks error reporting: a failing repository must not turn into a
    // different status than a successful one, or the difference becomes the oracle.
    const response = await buildApp(INVALID_FIELD).inject({
      method: "POST",
      url: "/auth/request-link",
      payload: { email: "m.brown@acme.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: "If that email is on file, a sign-in link is on its way.",
    });
  });
});
