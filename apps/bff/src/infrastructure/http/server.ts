import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { z } from "zod";
import { ORDER_PIPELINE } from "@wsc/shared";
import type { Env } from "../../config/env.js";
import type { GetOrders } from "../../application/get-orders.js";
import type { GetOrder } from "../../application/get-order.js";
import type { GetPayments } from "../../application/get-payments.js";
import type { GetDocuments } from "../../application/get-documents.js";
import type { RequestMagicLink } from "../../application/request-magic-link.js";
import type { VerifyMagicLink } from "../../application/verify-magic-link.js";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  signSessionJwt,
  verifySessionJwt,
  type SessionJwtConfig,
} from "../auth/session-jwt.js";
import {
  FixedWindowRateLimiter,
  REQUEST_LINK_EMAIL_RULE,
  REQUEST_LINK_IP_RULE,
} from "./rate-limiter.js";
import { DomainError, RateLimitedError, ValidationError } from "../../domain/errors.js";

/**
 * The ONE place a typed error becomes an HTTP status (CLAUDE.md §2). Anything not in this
 * table is a bug on our side and gets a 500 with no detail — the alternative is leaking
 * whatever an upstream happened to put in `message`.
 */
const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION: 422,
  CONFLICT: 409,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  UPSTREAM_MISCONFIGURED: 500,
  SALESFORCE_APEX: 502,
};

export interface ServerDeps {
  getOrders: GetOrders;
  getOrder: GetOrder;
  getPayments: GetPayments;
  getDocuments: GetDocuments;
  requestMagicLink: RequestMagicLink;
  verifyMagicLink: VerifyMagicLink;
  sessionConfig: SessionJwtConfig;
  /** Optional so tests can inject a fake clock and assert window expiry without sleeping. */
  rateLimiter?: FixedWindowRateLimiter;
}

const requestLinkBodySchema = z.object({ email: z.string().email() });
const verifyQuerySchema = z.object({ token: z.string().min(1) });
// Salesforce record ids are exactly 15 or 18 alphanumeric chars — validating the shape
// here (not just "non-empty") stops a malformed :id from ever reaching SOQL, where it
// would surface as a raw Salesforce query error (CLAUDE.md §2: never leak SFDC errors).
const SALESFORCE_ID = /^[A-Za-z0-9]{15}([A-Za-z0-9]{3})?$/;
const orderParamsSchema = z.object({ id: z.string().regex(SALESFORCE_ID) });
const documentParamsSchema = z.object({ id: z.string().regex(SALESFORCE_ID) });

/** Quotes a filename for `Content-Disposition`. Salesforce attachment names are free
 *  text, so quotes/backslashes are escaped and control characters (including the CR/LF
 *  that would let a name inject extra response headers) are dropped. */
function contentDisposition(filename: string): string {
  // eslint-disable-next-line no-control-regex -- stripping control chars is the point
  const safe = filename.replace(/[\u0000-\u001f\u007f]/g, "").replace(/["\\]/g, "\\$&");
  return `attachment; filename="${safe || "document"}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// Always the same response regardless of whether the email matched a client — prevents
// account enumeration (ARCHITECTURE.md §3.2).
const REQUEST_LINK_RESPONSE = {
  message: "If that email is on file, a sign-in link is on its way.",
};

function readSession(request: FastifyRequest, config: SessionJwtConfig) {
  const token = request.cookies[SESSION_COOKIE_NAME];
  return token ? verifySessionJwt(token, config) : null;
}

/**
 * Build the Fastify app (HTTP inbound adapter). Routes are thin: they validate input
 * (zod at the boundary) and delegate to injected use-cases, keeping the domain
 * framework-free (hexagonal — CLAUDE.md §2).
 */
export function buildServer(env: Env, deps: ServerDeps): FastifyInstance {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    // Required for the per-IP rule below to mean anything. Vercel rewrites `/api` and
    // `/auth` to Railway, so the socket address every request arrives from is the proxy's:
    // without this, all traffic shares one bucket and the IP rule locks out the world at
    // request 16. With it, `request.ip` comes from `X-Forwarded-For`.
    //
    // The trade-off is that a caller can prepend a forged `X-Forwarded-For` and evade
    // their own IP bucket. That is why the per-email rule — which reads the request body
    // and cannot be forged — is the strict one; the IP rule is a quota guard, not an
    // access control. Nothing but rate limiting reads `request.ip`.
    trustProxy: true,
  });
  app.register(fastifyCookie);

  const rateLimiter = deps.rateLimiter ?? new FixedWindowRateLimiter();

  app.addHook("onSend", async (_request, reply) => {
    // Earns its place on the download route: a Salesforce attachment whose stored
    // ContentType is wrong or absent could otherwise be sniffed as HTML by the browser
    // and executed inside the portal's own origin.
    reply.header("X-Content-Type-Options", "nosniff");

    // EVERY response here is scoped to one signed-in client by their session cookie, and
    // the BFF was setting no Cache-Control at all — so Vercel's proxy default applied and
    // the portal was answering `/api/orders` with `Cache-Control: public, max-age=0,
    // must-revalidate` and **no `Vary: Cookie`**. Revalidation is what kept that from
    // biting, but "public, keyed without the cookie" is one cache-config change away from
    // handing one client's orders to another. Stated explicitly instead of inherited.
    reply.header("Cache-Control", "private, no-store");
  });

  // Centralized error handling (CLAUDE.md §2). Route handlers throw typed errors and never
  // build status codes themselves; the upstream detail is logged here and dropped from the
  // response, because a Salesforce message routinely embeds the failing SOQL.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      const status = STATUS_BY_CODE[error.code] ?? 500;
      // 5xx means WE need to act on it — log loudly. 4xx is the caller's problem: still
      // recorded, but at a level that doesn't drown the real alerts.
      const log = status >= 500 ? request.log.error : request.log.warn;
      log.call(
        request.log,
        { code: error.code, detail: error.detail, status },
        `request failed: ${error.name}`,
      );

      if (error instanceof RateLimitedError) {
        reply.header("Retry-After", error.retryAfterSeconds);
      }
      return reply.code(status).send({
        error: error.message,
        code: error.code,
        ...(error instanceof ValidationError && error.fields.length > 0
          ? { fields: error.fields }
          : {}),
      });
    }

    // Fastify's own errors (malformed JSON body, unsupported media type…) carry a usable
    // status. Anything else is an unexpected throw and stays a bare 500 — its message is
    // an internal detail, so it goes to the log and not to the client.
    const fastifyError = error as { statusCode?: unknown; message?: unknown };
    const status =
      typeof fastifyError.statusCode === "number" ? fastifyError.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: error }, "unhandled error");
      return reply.code(500).send({ error: "Something went wrong.", code: "INTERNAL" });
    }
    request.log.warn({ err: error }, "bad request");
    const message =
      typeof fastifyError.message === "string" ? fastifyError.message : "Bad request.";
    return reply.code(status).send({ error: message, code: "BAD_REQUEST" });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "wsc-bff",
    pipelineStages: ORDER_PIPELINE.length,
  }));

  // Step 1 of the magic-link flow (ADR-0005): always resolves the same way — see
  // REQUEST_LINK_RESPONSE. Never reveals whether the email exists.
  app.post("/auth/request-link", async (request, reply) => {
    const parsed = requestLinkBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "A valid email is required" });
    }

    // Deliberately BEFORE the client lookup. A limiter that only counted real clients
    // would answer instantly for an unknown address and 429 for a known one — turning
    // itself into exactly the account-existence oracle REQUEST_LINK_RESPONSE prevents.
    const retryAfter =
      rateLimiter.hit(`ip:${request.ip}`, REQUEST_LINK_IP_RULE) ||
      rateLimiter.hit(`email:${parsed.data.email.trim().toLowerCase()}`, REQUEST_LINK_EMAIL_RULE);
    if (retryAfter > 0) {
      request.log.warn({ retryAfter }, "sign-in link rate limited");
      reply.header("Retry-After", retryAfter);
      return reply.code(429).send({
        error: "Too many sign-in requests. Please wait a few minutes and try again.",
        code: "RATE_LIMITED",
      });
    }

    try {
      await deps.requestMagicLink.execute(parsed.data.email);
    } catch (error) {
      // A delivery failure must NOT change the response: we only ever attempt a send for
      // an email that matched a client, so surfacing the error (or a 5xx) here would leak
      // exactly the account-existence bit REQUEST_LINK_RESPONSE exists to hide. Log it
      // server-side for the operator and stay silent to the caller (CLAUDE.md §2 — never
      // bubble raw upstream errors to the client).
      request.log.error({ err: error }, "magic-link delivery failed");
    }
    return REQUEST_LINK_RESPONSE;
  });

  // Step 2: the link the user clicked in their email. Sets the session cookie and
  // redirects — this is a full-page navigation, not an XHR (ARCHITECTURE.md §3.2).
  app.get("/auth/verify", async (request, reply) => {
    const parsed = verifyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.redirect(`${env.APP_BASE_URL}/?login_error=1`);
    }

    const payload = await deps.verifyMagicLink.execute(parsed.data.token);
    if (!payload) {
      return reply.redirect(`${env.APP_BASE_URL}/?login_error=1`);
    }

    const sessionJwt = signSessionJwt({ sub: payload.clientId, email: payload.email }, deps.sessionConfig);
    reply.setCookie(SESSION_COOKIE_NAME, sessionJwt, {
      path: "/",
      httpOnly: true,
      // Derived from APP_BASE_URL, not NODE_ENV. The portal's own base URL is what actually
      // states whether this deployment is served over TLS, and it is guaranteed present —
      // the magic link is built from it, and a malformed value fails the boot (it once
      // crash-looped the BFF, which is how we know). NODE_ENV, by contrast, is easy to
      // leave unset on a host: the cookie would then quietly ship without `Secure` and
      // nothing would look wrong.
      secure: env.APP_BASE_URL.startsWith("https://"),
      sameSite: "lax",
      // Same constant the JWT is signed with — see SESSION_TTL_SECONDS.
      maxAge: SESSION_TTL_SECONDS,
    });
    return reply.redirect(env.APP_BASE_URL);
  });

  app.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  // "My Orders" — every order for the signed-in client, newest first. This also doubles
  // as the app's "who am I" check (AppShell sidebar identity), so a client with a valid
  // session but zero orders gets an honest empty list, not a hard error.
  app.get("/api/orders", async (request, reply) => {
    const session = readSession(request, deps.sessionConfig);
    if (!session) {
      return reply.code(401).send({ error: "Not signed in" });
    }
    const orders = await deps.getOrders.execute(session.email);
    if (!orders) {
      return reply.code(404).send({ error: "No client found for this account" });
    }
    return orders;
  });

  // One order's detail, scoped to the signed-in client's own email (row-level authz —
  // the :id param can never select another client's order, CLAUDE.md §1).
  app.get("/api/orders/:id", async (request, reply) => {
    const session = readSession(request, deps.sessionConfig);
    if (!session) {
      return reply.code(401).send({ error: "Not signed in" });
    }
    const parsed = orderParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: "A valid order id is required" });
    }
    const order = await deps.getOrder.execute(session.email, parsed.data.id);
    if (!order) {
      return reply.code(404).send({ error: "Order not found" });
    }
    return order;
  });

  // "Payments" — every payment across every one of the signed-in client's orders.
  app.get("/api/payments", async (request, reply) => {
    const session = readSession(request, deps.sessionConfig);
    if (!session) {
      return reply.code(401).send({ error: "Not signed in" });
    }
    const payments = await deps.getPayments.execute(session.email);
    if (!payments) {
      return reply.code(404).send({ error: "No client found for this account" });
    }
    return payments;
  });

  // "Documents" — every attachment on the signed-in client's orders, each tagged with
  // the product (shelf corp) its order points at so the UI can group by what the client
  // recognizes.
  app.get("/api/documents", async (request, reply) => {
    const session = readSession(request, deps.sessionConfig);
    if (!session) {
      return reply.code(401).send({ error: "Not signed in" });
    }
    const documents = await deps.getDocuments.list(session.email);
    if (!documents) {
      return reply.code(404).send({ error: "No client found for this account" });
    }
    return documents;
  });

  // File download, proxied through the BFF — the browser never talks to Salesforce and
  // never sees a Salesforce token (CLAUDE.md §0). Ownership is re-checked server-side, so
  // a guessed attachment id yields 404, not someone else's file.
  app.get("/api/documents/:id/download", async (request, reply) => {
    const session = readSession(request, deps.sessionConfig);
    if (!session) {
      return reply.code(401).send({ error: "Not signed in" });
    }
    const parsed = documentParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: "A valid document id is required" });
    }
    const download = await deps.getDocuments.download(session.email, parsed.data.id);
    if (!download) {
      return reply.code(404).send({ error: "Document not found" });
    }
    return reply
      .header("Content-Type", download.document.contentType ?? "application/octet-stream")
      .header("Content-Disposition", contentDisposition(download.document.name))
      .header("Content-Length", download.body.byteLength)
      // `Cache-Control: private, no-store` is applied to every response by the onSend hook
      // above — client paperwork was the reason it started here.
      .send(download.body);
  });

  return app;
}
