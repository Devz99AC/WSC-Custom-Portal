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
  signSessionJwt,
  verifySessionJwt,
  type SessionJwtConfig,
} from "../auth/session-jwt.js";

export interface ServerDeps {
  getOrders: GetOrders;
  getOrder: GetOrder;
  getPayments: GetPayments;
  getDocuments: GetDocuments;
  requestMagicLink: RequestMagicLink;
  verifyMagicLink: VerifyMagicLink;
  sessionConfig: SessionJwtConfig;
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
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });
  app.register(fastifyCookie);

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
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 45 * 60,
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
      // Client paperwork is private to one client — keep it out of shared caches.
      .header("Cache-Control", "private, no-store")
      .send(download.body);
  });

  return app;
}
