import { existsSync, readFileSync } from "node:fs";
import jwt from "jsonwebtoken";

export type JwtBearerConfig = {
  clientId: string;
  privateKey: string;
  username: string;
  loginUrl: string;
};

type TokenResponse = {
  access_token: string;
  instance_url: string;
};

type CachedToken = { accessToken: string; instanceUrl: string; expiresAt: number };

/**
 * In-memory cache only — one BFF process, refreshed proactively below. Move to
 * Redis when the shared cache layer lands (ROADMAP 1.9 / STATUS.md G6); the
 * `getJwtAccessToken`/`invalidateJwtAccessToken` boundary stays the same either way.
 */
let cached: CachedToken | null = null;

/** Accepts either the PEM contents directly (deployed hosts) or a path to the key file (local dev). */
function resolvePrivateKey(value: string): string {
  if (value.includes("BEGIN") || !existsSync(value)) {
    return value;
  }
  return readFileSync(value, "utf8");
}

/**
 * OAuth 2.0 JWT Bearer flow (CLAUDE.md §1): sign a short-lived assertion with the
 * integration user's private key and exchange it for an access token. No refresh
 * token, no browser, no CLI session — this is the mechanism that works from any
 * host, unlike `createDevSalesforceQuery`'s reused CLI session.
 */
export async function getJwtAccessToken(
  config: JwtBearerConfig
): Promise<{ accessToken: string; instanceUrl: string }> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { accessToken: cached.accessToken, instanceUrl: cached.instanceUrl };
  }

  const assertion = jwt.sign(
    { iss: config.clientId, sub: config.username, aud: config.loginUrl },
    resolvePrivateKey(config.privateKey),
    { algorithm: "RS256", expiresIn: "3m" }
  );

  const response = await fetch(`${config.loginUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Salesforce JWT Bearer token exchange failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as TokenResponse;
  // Salesforce doesn't return a TTL for this grant type; cache conservatively and
  // rely on invalidateJwtAccessToken() for reactive refresh on INVALID_SESSION_ID.
  cached = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
    expiresAt: now + 10 * 60 * 1000,
  };
  return { accessToken: data.access_token, instanceUrl: data.instance_url };
}

/** Call after an INVALID_SESSION_ID response so the next call re-mints a token (CLAUDE.md §1). */
export function invalidateJwtAccessToken(): void {
  cached = null;
}

export function isInvalidSessionError(error: unknown): boolean {
  const errorCode = (error as { errorCode?: string } | null)?.errorCode;
  return errorCode === "INVALID_SESSION_ID";
}
