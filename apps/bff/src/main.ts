import { loadEnv } from "./config/env.js";
import { buildServer } from "./infrastructure/http/server.js";

/**
 * Composition root: load config, wire adapters, start listening. This is the only
 * place that assembles concrete dependencies (plain DI — CLAUDE.md §2). Phase 0
 * wires nothing but the HTTP server + a health route.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const app = buildServer(env);
  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
