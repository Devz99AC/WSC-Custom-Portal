import { loadEnv } from "./config/env.js";
import { GetDashboard } from "./application/get-dashboard.js";
import type { PortalRepository } from "./application/ports/portal-repository.js";
import { MockPortalRepository } from "./infrastructure/repositories/mock-portal-repository.js";
import {
  createDevSalesforceQuery,
  createJwtSalesforceQuery,
} from "./infrastructure/salesforce/salesforce-query.js";
import { SalesforcePortalRepository } from "./infrastructure/salesforce/salesforce-portal-repository.js";
import { buildServer } from "./infrastructure/http/server.js";

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
  const app = buildServer(env, { getDashboard });
  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
