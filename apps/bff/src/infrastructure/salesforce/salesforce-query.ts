import { getJwtAccessToken, invalidateJwtAccessToken, isInvalidSessionError } from "./salesforce-jwt-auth.js";
import type { JwtBearerConfig } from "./salesforce-jwt-auth.js";

export type SalesforceRecord = Record<string, unknown>;

/** Minimal read port: run a SOQL string, get raw records. Keeps the repository
 *  independent of HOW we authenticate (dev CLI session now, JWT Bearer in prod). */
export type SalesforceQuery = (soql: string) => Promise<SalesforceRecord[]>;

/** Fetches an `Attachment`'s bytes. SOQL can't return the `Body` blob, so this is a
 *  separate REST call — and it stays behind its own port so the repository never has to
 *  know the API version or how the request is authenticated. Resolves to null when
 *  Salesforce says the record isn't there. */
export type SalesforceAttachmentBody = (attachmentId: string) => Promise<Buffer | null>;

/** Reads an attachment body over plain REST. Both adapters share this: the only thing
 *  that differs between them is how the access token was obtained. */
async function fetchAttachmentBody(
  instanceUrl: string,
  accessToken: string,
  apiVersion: string,
  attachmentId: string,
): Promise<Buffer | null> {
  const version = apiVersion.replace(/^v/i, "");
  const response = await fetch(
    `${instanceUrl}/services/data/v${version}/sobjects/Attachment/${encodeURIComponent(attachmentId)}/Body`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Salesforce attachment body fetch failed (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * DEV-ONLY Salesforce connection. Reuses the Salesforce CLI's stored authorization
 * (the `sf org login` session) so the demo can read live data WITHOUT a Connected App
 * or JWT. Production replaces this factory with the JWT Bearer flow (ROADMAP 1.6) — the
 * `SalesforceQuery` port and the repository above it stay exactly the same.
 */
export async function createDevSalesforceQuery(
  username: string,
): Promise<{ query: SalesforceQuery; attachmentBody: SalesforceAttachmentBody }> {
  const { AuthInfo, Connection } = await import("@salesforce/core");
  const authInfo = await AuthInfo.create({ username });
  const connection = await Connection.create({ authInfo });

  return {
    query: async (soql: string): Promise<SalesforceRecord[]> => {
      const result = await connection.query(soql);
      return result.records as unknown as SalesforceRecord[];
    },
    attachmentBody: (attachmentId: string): Promise<Buffer | null> =>
      fetchAttachmentBody(
        connection.instanceUrl,
        connection.accessToken ?? "",
        connection.version,
        attachmentId,
      ),
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
): Promise<{ query: SalesforceQuery; attachmentBody: SalesforceAttachmentBody }> {
  const { Connection } = await import("@jsforce/jsforce-node");

  /** Runs `attempt`, and on an expired session re-mints the JWT and retries exactly once
   *  (CLAUDE.md §1 — `INVALID_SESSION_ID` is transient, not a failure). */
  const withSessionRetry = async <T>(attempt: () => Promise<T>): Promise<T> => {
    try {
      return await attempt();
    } catch (error) {
      if (!isInvalidSessionError(error)) {
        throw error;
      }
      invalidateJwtAccessToken();
      return attempt();
    }
  };

  return {
    query: (soql: string): Promise<SalesforceRecord[]> =>
      withSessionRetry(async () => {
        const { accessToken, instanceUrl } = await getJwtAccessToken(config);
        // jsforce-node prepends its own "v" when building /services/data/v{version} —
        // strip a leading v/V so SF_API_VERSION works whether it's "v67.0" or "67.0".
        const version = config.apiVersion.replace(/^v/i, "");
        const connection = new Connection({ accessToken, instanceUrl, version });
        const result = await connection.query(soql);
        return result.records as unknown as SalesforceRecord[];
      }),

    attachmentBody: (attachmentId: string): Promise<Buffer | null> =>
      withSessionRetry(async () => {
        const { accessToken, instanceUrl } = await getJwtAccessToken(config);
        return fetchAttachmentBody(instanceUrl, accessToken, config.apiVersion, attachmentId);
      }),
  };
}
