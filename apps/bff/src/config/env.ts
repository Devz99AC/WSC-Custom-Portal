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
