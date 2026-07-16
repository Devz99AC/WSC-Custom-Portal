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
