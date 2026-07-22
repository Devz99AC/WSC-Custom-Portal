import { getJwtAccessToken, invalidateJwtAccessToken, isInvalidSessionError } from "./salesforce-jwt-auth.js";
import type { JwtBearerConfig } from "./salesforce-jwt-auth.js";

export type SalesforceRecord = Record<string, unknown>;

/** Minimal read port: run a SOQL string, get raw records. Keeps the repository
 *  independent of HOW we authenticate (dev CLI session now, JWT Bearer in prod). */
export type SalesforceQuery = (soql: string) => Promise<SalesforceRecord[]>;

/**
 * DEV-ONLY Salesforce connection. Reuses the Salesforce CLI's stored authorization
 * (the `sf org login` session) so the demo can read live data WITHOUT a Connected App
 * or JWT. Production replaces this factory with the JWT Bearer flow (ROADMAP 1.6) — the
 * `SalesforceQuery` port and the repository above it stay exactly the same.
 */
export async function createDevSalesforceQuery(username: string): Promise<SalesforceQuery> {
  const { AuthInfo, Connection } = await import("@salesforce/core");
  const authInfo = await AuthInfo.create({ username });
  const connection = await Connection.create({ authInfo });

  return async (soql: string): Promise<SalesforceRecord[]> => {
    const result = await connection.query(soql);
    return result.records as unknown as SalesforceRecord[];
  };
}

/**
 * PRODUCTION Salesforce connection (ROADMAP 1.6): authenticates via the OAuth 2.0
 * JWT Bearer flow — no browser, no CLI session, works from any host. Reuses the
 * exact same `SalesforceQuery` port as the dev adapter above, so
 * `SalesforcePortalRepository` and everything above it never changes.
 */
export async function createJwtSalesforceQuery(
  config: JwtBearerConfig & { apiVersion: string }
): Promise<SalesforceQuery> {
  const { Connection } = await import("@jsforce/jsforce-node");

  return async (soql: string): Promise<SalesforceRecord[]> => {
    const run = async (): Promise<SalesforceRecord[]> => {
      const { accessToken, instanceUrl } = await getJwtAccessToken(config);
      // jsforce-node prepends its own "v" when building /services/data/v{version} —
      // strip a leading v/V so SF_API_VERSION works whether it's "v67.0" or "67.0".
      const version = config.apiVersion.replace(/^v/i, "");
      const connection = new Connection({ accessToken, instanceUrl, version });
      const result = await connection.query(soql);
      return result.records as unknown as SalesforceRecord[];
    };

    try {
      return await run();
    } catch (error) {
      if (!isInvalidSessionError(error)) {
        throw error;
      }
      invalidateJwtAccessToken();
      return run();
    }
  };
}
