export interface MagicLinkPayload {
  clientId: string;
  email: string;
}

/**
 * Port for the single-use magic-link token (ADR-0005, ARCHITECTURE.md §3.2). Tokens are
 * looked up by their HASH — the raw token never touches storage, only the emailed link.
 */
export interface MagicLinkStore {
  save(tokenHash: string, payload: MagicLinkPayload, ttlSeconds: number): Promise<void>;

  /** Fetch-and-delete in one step (enforces single-use). Null if missing or expired. */
  consume(tokenHash: string): Promise<MagicLinkPayload | null>;
}
