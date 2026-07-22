import type { MagicLinkStore, MagicLinkPayload } from "./ports/magic-link-store.js";
import { hashMagicLinkToken } from "./magic-link-token.js";

/**
 * Use-case: resolve a single-use magic-link token to the identity it was issued for
 * (ADR-0005). Returns null for an invalid, expired, or already-consumed token. Signing
 * the session JWT and setting the cookie is an HTTP concern, done by the route that
 * calls this — this use-case only knows about the MagicLinkStore port.
 */
export class VerifyMagicLink {
  constructor(private readonly store: MagicLinkStore) {}

  execute(rawToken: string): Promise<MagicLinkPayload | null> {
    return this.store.consume(hashMagicLinkToken(rawToken));
  }
}
