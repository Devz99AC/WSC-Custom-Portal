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
import { hashMagicLinkToken } from "../../application/magic-link-token.js";
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

function buildApp(
  failure: unknown,
  options: {
    appBaseUrl?: string;
    magicLinkStore?: InMemoryMagicLinkStore;
    repository?: PortalRepository;
  } = {},
) {
  const repository = options.repository ?? new FailingRepository(failure);
  return buildServer(
    loadEnv({
      LOG_LEVEL: "silent",
      ...(options.appBaseUrl === undefined ? {} : { APP_BASE_URL: options.appBaseUrl }),
    }),
    {
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
      verifyMagicLink: new VerifyMagicLink(
        options.magicLinkStore ?? new InMemoryMagicLinkStore(),
      ),
      sessionConfig: SESSION_CONFIG,
    },
  );
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

  it("falls back to the granted response when the lookup itself blows up — never 'no access'", async () => {
    // A Salesforce hiccup must not tell a real client they have no account: the failure is
    // logged server-side and the visitor still sees the granted ("check your email") reply.
    const response = await buildApp(INVALID_FIELD).inject({
      method: "POST",
      url: "/auth/request-link",
      payload: { email: "m.brown@acme.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "sent" });
  });
});

/**
 * The login screen now reveals whether an email has portal access (stakeholder decision
 * 2026-08-08): a granted address is told the link is on its way, a denied one is told the
 * email has no active order. This reverses the old anti-enumeration response on purpose.
 */
describe("sign-in link reveals whether an email has portal access", () => {
  const WITH_ACCESS = "m.brown@acme.com";

  /** Resolves a client only for WITH_ACCESS — stands in for the access gate (a live order).
   *  The other reads are never hit on the request-link path, so they just return empty. */
  class ResolvingRepository implements PortalRepository {
    findClientByEmail(email: string) {
      return Promise.resolve(
        email === WITH_ACCESS ? { id: "c1", email: WITH_ACCESS, name: "Marcus" } : null,
      );
    }
    listOrdersByEmail() {
      return Promise.resolve(null);
    }
    getOrderByEmailAndId() {
      return Promise.resolve(null);
    }
    listPaymentsByEmail() {
      return Promise.resolve(null);
    }
    listDocumentsByEmail() {
      return Promise.resolve(null);
    }
    getDocumentForDownload() {
      return Promise.resolve(null);
    }
  }

  const requestLink = (email: string) =>
    buildApp(undefined, { repository: new ResolvingRepository() }).inject({
      method: "POST",
      url: "/auth/request-link",
      payload: { email },
    });

  it("tells a client with access their link is on its way", async () => {
    const response = await requestLink(WITH_ACCESS);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "sent" });
  });

  it("tells a visitor with no access that the email isn't linked to an active order", async () => {
    const response = await requestLink("stranger@example.com");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "denied" });
  });
});

/**
 * The `Secure` flag decides whether the session cookie may travel over plain HTTP. It used
 * to hang off `NODE_ENV`, which a host can silently be missing — the cookie would ship
 * unprotected and nothing would look wrong. It now follows `APP_BASE_URL`'s scheme, which
 * production cannot be without, so these two cases are the contract.
 */
describe("session cookie", () => {
  const RAW_TOKEN = "raw-token-for-test";

  const signIn = async (appBaseUrl: string) => {
    const store = new InMemoryMagicLinkStore();
    await store.save(
      hashMagicLinkToken(RAW_TOKEN),
      { clientId: "c1", email: "m.brown@acme.com" },
      900,
    );
    const response = await buildApp(INVALID_FIELD, { appBaseUrl, magicLinkStore: store }).inject({
      method: "GET",
      url: `/auth/verify?token=${RAW_TOKEN}`,
    });
    return String(response.headers["set-cookie"]);
  };

  it("is Secure + HttpOnly when the portal is served over HTTPS", async () => {
    const cookie = await signIn("https://portal.wholesaleshelfcorporations.com");
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/HttpOnly/);
    // 60 minutes — the JWT's own lifetime, so the browser can't hold a token the server
    // has already stopped accepting (or drop one it would still take).
    expect(cookie).toMatch(/Max-Age=3600/);
  });

  it("drops Secure on a plain-HTTP base URL, or local dev could never sign in", async () => {
    const cookie = await signIn("http://localhost:5173");
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).not.toMatch(/Secure/);
    expect(cookie).toMatch(/HttpOnly/);
  });
});

/**
 * `/auth/request-link` is the only route reachable without a session. Unlimited, it lets an
 * outsider flood a client's inbox with sign-in links and burn WSC's Salesforce API quota —
 * every call costs one SOQL lookup. Each `buildApp()` gets its own limiter, so these cases
 * don't leak counts into one another.
 */
describe("sign-in link rate limiting", () => {
  const requestLink = (app: ReturnType<typeof buildApp>, email: string) =>
    app.inject({ method: "POST", url: "/auth/request-link", payload: { email } });

  it("refuses a fourth link for the same address inside the window", async () => {
    const app = buildApp(INVALID_FIELD);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await requestLink(app, "m.brown@acme.com")).statusCode).toBe(200);
    }

    const refused = await requestLink(app, "m.brown@acme.com");
    expect(refused.statusCode).toBe(429);
    expect(refused.headers["retry-after"]).toBeDefined();
    // The refusal must not name Salesforce, the client, or whether the address exists.
    expect(refused.json()).toEqual({ error: expect.any(String), code: "RATE_LIMITED" });
  });

  it("normalizes case, so re-typing the address differently doesn't reset the count", async () => {
    const app = buildApp(INVALID_FIELD);

    await requestLink(app, "m.brown@acme.com");
    await requestLink(app, "M.BROWN@acme.com");
    await requestLink(app, "M.Brown@Acme.com");

    expect((await requestLink(app, "m.brown@acme.com")).statusCode).toBe(429);
  });

  it("caps a caller cycling through fresh addresses — the API-quota case", async () => {
    const app = buildApp(INVALID_FIELD);
    // Each address is new, so the per-email rule never trips; only the per-IP rule can
    // stop this, which is the whole reason there are two rules.
    const statuses: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      statuses.push((await requestLink(app, `client${i}@acme.com`)).statusCode);
    }

    expect(statuses.filter((status) => status === 200)).toHaveLength(15);
    expect(statuses.at(-1)).toBe(429);
  });
});
