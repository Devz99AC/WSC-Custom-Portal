import type { MagicLinkPayload, MagicLinkStore } from "../../application/ports/magic-link-store.js";

type Entry = { payload: MagicLinkPayload; expiresAt: number };

/**
 * Single-process in-memory store. Fine for one BFF instance; a restart or a second
 * instance behind a load balancer would lose/miss tokens. Move to Redis (STATUS.md G6)
 * before running more than one instance — the port above doesn't change either way.
 */
export class InMemoryMagicLinkStore implements MagicLinkStore {
  private readonly entries = new Map<string, Entry>();

  save(tokenHash: string, payload: MagicLinkPayload, ttlSeconds: number): Promise<void> {
    this.entries.set(tokenHash, { payload, expiresAt: Date.now() + ttlSeconds * 1000 });
    return Promise.resolve();
  }

  consume(tokenHash: string): Promise<MagicLinkPayload | null> {
    const entry = this.entries.get(tokenHash);
    this.entries.delete(tokenHash); // single-use regardless of outcome
    if (!entry || entry.expiresAt < Date.now()) {
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.payload);
  }
}
