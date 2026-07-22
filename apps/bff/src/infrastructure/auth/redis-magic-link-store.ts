import type { Redis } from "ioredis";
import type { MagicLinkPayload, MagicLinkStore } from "../../application/ports/magic-link-store.js";

const KEY_PREFIX = "wsc:magic-link:";

/**
 * Redis-backed magic-link store — survives restarts and works across multiple BFF
 * instances, unlike InMemoryMagicLinkStore. Uses GETDEL (Redis 6.2+) so fetch-and-delete
 * is a single atomic operation: two concurrent requests for the same token can't both
 * succeed (single-use, ADR-0005).
 */
export class RedisMagicLinkStore implements MagicLinkStore {
  constructor(private readonly client: Redis) {}

  async save(tokenHash: string, payload: MagicLinkPayload, ttlSeconds: number): Promise<void> {
    await this.client.set(KEY_PREFIX + tokenHash, JSON.stringify(payload), "EX", ttlSeconds);
  }

  async consume(tokenHash: string): Promise<MagicLinkPayload | null> {
    const raw = await this.client.getdel(KEY_PREFIX + tokenHash);
    return raw ? (JSON.parse(raw) as MagicLinkPayload) : null;
  }
}
