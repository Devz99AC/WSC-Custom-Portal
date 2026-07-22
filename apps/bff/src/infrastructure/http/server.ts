import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { z } from "zod";
import { ORDER_PIPELINE } from "@wsc/shared";
import type { Env } from "../../config/env.js";
import type { GetDashboard } from "../../application/get-dashboard.js";
import type { RequestMagicLink } from "../../application/request-magic-link.js";
import type { VerifyMagicLink } from "../../application/verify-magic-link.js";
import {
  SESSION_COOKIE_NAME,
  signSessionJwt,
  verifySessionJwt,
  type SessionJwtConfig,
} from "../auth/session-jwt.js";

export interface ServerDeps {
  getDashboard: GetDashboard;
  requestMagicLink: RequestMagicLink;
  verifyMagicLink: VerifyMagicLink;
  sessionConfig: SessionJwtConfig;
}

const requestLinkBodySchema = z.object({ email: z.string().email() });
const verifyQuerySchema = z.object({ token: z.string().min(1) });

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
    await deps.requestMagicLink.execute(parsed.data.email);
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

  // Resolved from the session cookie only — never a client-supplied id/email
  // (CLAUDE.md §Security). 401 if the cookie is missing/invalid/expired.
  app.get("/api/dashboard", async (request, reply) => {
    const session = readSession(request, deps.sessionConfig);
    if (!session) {
      return reply.code(401).send({ error: "Not signed in" });
    }
    const dashboard = await deps.getDashboard.execute(session.email);
    if (!dashboard) {
      return reply.code(404).send({ error: "No order found for this account" });
    }
    return dashboard;
  });

  return app;
}
