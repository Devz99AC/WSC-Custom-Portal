import jwt from "jsonwebtoken";

export interface SessionClaims {
  sub: string; // FU_User__c.Id — resolved identity, never a client-supplied value
  email: string;
}

export interface SessionJwtConfig {
  secret: string;
  kid: string;
}

export const SESSION_COOKIE_NAME = "wsc_session";

/** Short-lived per ARCHITECTURE.md §3.2 ("~30–60 min"). No refresh token yet — re-auth via magic-link. */
const SESSION_TTL_SECONDS = 45 * 60;

export function signSessionJwt(claims: SessionClaims, config: SessionJwtConfig): string {
  return jwt.sign(claims, config.secret, {
    algorithm: "HS256",
    expiresIn: SESSION_TTL_SECONDS,
    keyid: config.kid,
  });
}

/** Returns null on any invalid/expired/malformed token — callers treat this as "not signed in". */
export function verifySessionJwt(token: string, config: SessionJwtConfig): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, config.secret, { algorithms: ["HS256"] });
    if (typeof decoded === "string") {
      return null;
    }
    const { sub, email } = decoded;
    if (typeof sub !== "string" || typeof email !== "string") {
      return null;
    }
    return { sub, email };
  } catch {
    return null;
  }
}
