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

/**
 * Short-lived per ARCHITECTURE.md §3.2 ("~30–60 min"). No refresh token yet — when it
 * lapses the client requests a new magic link, so this is the top of that range: at 45
 * minutes a client reading through their documents was being turned out mid-task
 * (stakeholder, 2026-08-07).
 *
 * **Exported because the cookie's `maxAge` must match it.** They were two separate literals
 * and a change to one silently desynchronised them — a longer cookie leaves the browser
 * sending a token the server already rejects, a shorter one signs the client out early.
 */
export const SESSION_TTL_SECONDS = 60 * 60;

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
