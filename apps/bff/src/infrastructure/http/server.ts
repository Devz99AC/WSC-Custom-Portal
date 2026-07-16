import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { ORDER_PIPELINE } from "@wsc/shared";
import type { Env } from "../../config/env.js";
import type { GetDashboard } from "../../application/get-dashboard.js";

export interface ServerDeps {
  getDashboard: GetDashboard;
}

const dashboardQuerySchema = z.object({ email: z.string().email() });

/**
 * Build the Fastify app (HTTP inbound adapter). Routes are thin: they validate input
 * (zod at the boundary) and delegate to injected use-cases, keeping the domain
 * framework-free (hexagonal — CLAUDE.md §2).
 */
export function buildServer(env: Env, deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  app.get("/health", async () => ({
    status: "ok",
    service: "wsc-bff",
    pipelineStages: ORDER_PIPELINE.length,
  }));

  // Demo read endpoint. Auth is stubbed: the email stands in for the resolved session
  // identity. In Phase 1 this becomes the verified magic-link JWT → FU_User__c resolution
  // with row-level authz — never a client-supplied id/email (CLAUDE.md §Security).
  app.get("/api/dashboard", async (request, reply) => {
    const parsed = dashboardQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "A valid ?email= query parameter is required" });
    }
    const dashboard = await deps.getDashboard.execute(parsed.data.email);
    if (!dashboard) {
      return reply.code(404).send({ error: "No order found for this email" });
    }
    return dashboard;
  });

  return app;
}
