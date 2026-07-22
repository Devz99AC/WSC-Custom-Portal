import { randomBytes } from "node:crypto";
import { loadEnv, type Env } from "./config/env.js";
import { GetDashboard } from "./application/get-dashboard.js";
import { RequestMagicLink } from "./application/request-magic-link.js";
import { VerifyMagicLink } from "./application/verify-magic-link.js";
import type { PortalRepository } from "./application/ports/portal-repository.js";
import type { EmailSender } from "./application/ports/email-sender.js";
import { MockPortalRepository } from "./infrastructure/repositories/mock-portal-repository.js";
import {
  createDevSalesforceQuery,
  createJwtSalesforceQuery,
} from "./infrastructure/salesforce/salesforce-query.js";
import { SalesforcePortalRepository } from "./infrastructure/salesforce/salesforce-portal-repository.js";
import { InMemoryMagicLinkStore } from "./infrastructure/auth/in-memory-magic-link-store.js";
import { createConsoleEmailSender } from "./infrastructure/email/console-email-sender.js";
import { createSmtpEmailSender } from "./infrastructure/email/smtp-email-sender.js";
import { renderMagicLinkEmail } from "./infrastructure/email/magic-link-template.js";
import { buildServer } from "./infrastructure/http/server.js";

/** Required in production; falls back to a per-boot random secret in dev so `pnpm dev`
 *  works with no setup — sessions just won't survive a restart until it's set for real. */
function resolveSessionSecret(env: Env): string {
  if (env.SESSION_JWT_SECRET) {
    return env.SESSION_JWT_SECRET;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("SESSION_JWT_SECRET is required in production");
  }
  console.warn(
    "SESSION_JWT_SECRET not set — using an ephemeral dev-only secret (sessions won't " +
      "survive a restart). Set it in .env.local for anything beyond quick local testing.",
  );
  return randomBytes(32).toString("hex");
}

function buildEmailSender(env: Env): EmailSender {
  if (env.EMAIL_SENDER !== "smtp") {
    return createConsoleEmailSender();
  }
  if (!env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM_EMAIL) {
    throw new Error("SMTP_USER, SMTP_PASSWORD and SMTP_FROM_EMAIL are required when EMAIL_SENDER=smtp");
  }
  return createSmtpEmailSender({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    fromEmail: env.SMTP_FROM_EMAIL,
    fromName: env.SMTP_FROM_NAME,
  });
}

/**
 * Composition root: load config, wire adapters, start listening. The data source is
 * chosen here from env — this is the ONE place that changes to go from demo mock data
 * to live Salesforce (CLAUDE.md §2). Everything above the PortalRepository port is
 * unaware of which adapter is running.
 */
async function main(): Promise<void> {
  const env = loadEnv();

  let repository: PortalRepository;
  if (env.PORTAL_DATA_SOURCE === "salesforce") {
    if (!env.SF_TARGET_USERNAME) {
      throw new Error("SF_TARGET_USERNAME is required when PORTAL_DATA_SOURCE=salesforce");
    }
    const query = await createDevSalesforceQuery(env.SF_TARGET_USERNAME);
    repository = new SalesforcePortalRepository(query);
  } else if (env.PORTAL_DATA_SOURCE === "salesforce-jwt") {
    if (!env.SF_CLIENT_ID || !env.SF_JWT_PRIVATE_KEY || !env.SF_INTEGRATION_USERNAME || !env.SF_LOGIN_URL) {
      throw new Error(
        "SF_CLIENT_ID, SF_JWT_PRIVATE_KEY, SF_INTEGRATION_USERNAME and SF_LOGIN_URL are required when PORTAL_DATA_SOURCE=salesforce-jwt"
      );
    }
    const query = await createJwtSalesforceQuery({
      clientId: env.SF_CLIENT_ID,
      privateKey: env.SF_JWT_PRIVATE_KEY,
      username: env.SF_INTEGRATION_USERNAME,
      loginUrl: env.SF_LOGIN_URL,
      apiVersion: env.SF_API_VERSION,
    });
    repository = new SalesforcePortalRepository(query);
  } else {
    repository = new MockPortalRepository();
  }

  const getDashboard = new GetDashboard(repository);

  const sessionConfig = { secret: resolveSessionSecret(env), kid: env.SESSION_JWT_KID };
  const magicLinkStore = new InMemoryMagicLinkStore();
  const sendEmail = buildEmailSender(env);
  const requestMagicLink = new RequestMagicLink(repository, magicLinkStore, sendEmail, renderMagicLinkEmail, {
    appBaseUrl: env.APP_BASE_URL,
    ttlSeconds: env.MAGIC_LINK_TTL_SECONDS,
  });
  const verifyMagicLink = new VerifyMagicLink(magicLinkStore);

  const app = buildServer(env, { getDashboard, requestMagicLink, verifyMagicLink, sessionConfig });
  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
