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

  // Customer identity (ADR-0005: BFF-native magic-link, ARCHITECTURE.md §3.2).
  SESSION_JWT_SECRET: z.string().min(1).optional(),
  SESSION_JWT_KID: z.string().min(1).default("1"),
  MAGIC_LINK_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  APP_BASE_URL: z.string().url().default("http://localhost:5173"),

  // Email delivery for the magic-link. "console" (default, dev) logs the link instead of
  // sending it. "smtp" sends via Google Workspace (or any SMTP account) — no separate
  // transactional-email vendor, reuses a mailbox WSC already pays for.
  EMAIL_SENDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().min(1).default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().min(1).default("WSC Client Portal"),

  // Optional. When set, the magic-link store persists to Redis instead of an
  // in-memory Map — required once more than one BFF instance runs, or to survive
  // restarts (STATUS.md G6). Falls back to in-memory if unset (single-instance dev).
  REDIS_URL: z.string().url().optional(),
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
