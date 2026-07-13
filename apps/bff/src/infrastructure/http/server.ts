import Fastify, { type FastifyInstance } from "fastify";
import { ORDER_STAGES } from "@wsc/shared";
import type { Env } from "../../config/env.js";

/**
 * Build the Fastify application (infrastructure adapter — the HTTP inbound port).
 *
 * Phase 0 exposes only a liveness probe: no business endpoints, no auth, no
 * Salesforce. Real routes will be added as thin handlers delegating to
 * `application/` use-cases, keeping the domain framework-free (hexagonal — §5.1).
 */
export function buildServer(env: Env): FastifyInstance {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "wsc-bff",
    phase: 0,
    // Proves @wsc/shared imports into the BFF (Phase 0 DoD); not business logic.
    pipelineStages: ORDER_STAGES.length,
  }));

  return app;
}
