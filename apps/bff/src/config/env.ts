import { z } from "zod";

/**
 * Environment validation at the process boundary (zod at the edge — CLAUDE.md §2,
 * ROADMAP §5.3). Types are derived from the schema so config cannot lie at runtime.
 *
 * Phase 0 only requires non-secret operational vars. Integration secrets
 * (Salesforce, Stripe, S3, …) are declared in `.env.example` and validated in the
 * phase that introduces the adapter consuming them — we do not force them to exist
 * for an empty skeleton to boot.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  // Demo data source. "mock" = in-memory real-shaped data; "salesforce" = live reads
  // reusing the CLI's stored auth (dev-only, one developer machine); "salesforce-jwt" =
  // live reads via the real OAuth 2.0 JWT Bearer flow (works from any host, CLAUDE.md §1).
  PORTAL_DATA_SOURCE: z.enum(["mock", "salesforce", "salesforce-jwt"]).default("mock"),
  // Username of the authorized org (e.g. from `sf org list`). Required for "salesforce".
  SF_TARGET_USERNAME: z.string().min(1).optional(),
  // JWT Bearer flow config. Required for "salesforce-jwt" (checked in the composition
  // root, not here, matching how SF_TARGET_USERNAME is handled above).
  SF_CLIENT_ID: z.string().min(1).optional(),
  // Either the PEM contents directly (deployed hosts) or a path to the key file (local dev).
  SF_JWT_PRIVATE_KEY: z.string().min(1).optional(),
  SF_INTEGRATION_USERNAME: z.string().min(1).optional(),
  SF_LOGIN_URL: z.string().url().optional(),
  SF_API_VERSION: z.string().min(1).default("v62.0"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment configuration. On failure, throws with the
 * offending keys only — never the values (no secret leakage; CLAUDE.md §4).
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration for: ${keys}`);
  }
  return parsed.data;
}
