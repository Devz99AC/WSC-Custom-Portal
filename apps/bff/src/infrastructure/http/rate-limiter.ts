/**
 * Fixed-window rate limiting for `/auth/request-link` — the only endpoint reachable
 * without a session, and therefore the only one an outsider can abuse.
 *
 * Two distinct harms, so two rules (see REQUEST_LINK_* below):
 *  - **per email** — stops someone flooding one client's inbox with sign-in links. This is
 *    the rule that actually holds, because the email is the request body: it cannot be
 *    spoofed the way a source address can.
 *  - **per IP** — stops someone burning WSC's Salesforce API quota by cycling addresses,
 *    since every request costs one SOQL lookup. Best-effort: see `trustProxy` in server.ts.
 *
 * In-process on purpose. The counters live in this instance's memory, so running more than
 * one BFF replica multiplies the effective limit by the replica count. Railway runs one
 * today; if that changes, move the counters to the Redis that `ioredis` already provides
 * (same shape as the magic-link store's memory/Redis split).
 */

export interface RateLimitRule {
  /** Requests allowed inside one window. */
  limit: number;
  windowSeconds: number;
}

/** Seconds the caller must wait before retrying, or 0 when the request is allowed. */
export type RetryAfterSeconds = number;

/** Three is "I didn't get it, send it again" twice — past that it isn't a real person. */
export const REQUEST_LINK_EMAIL_RULE: RateLimitRule = { limit: 3, windowSeconds: 900 };

/** Looser: a family or an office can legitimately share one address. */
export const REQUEST_LINK_IP_RULE: RateLimitRule = { limit: 15, windowSeconds: 900 };

/** Above this many tracked keys the limiter is itself the memory-exhaustion target. */
const MAX_TRACKED_KEYS = 10_000;

interface Window {
  count: number;
  resetAtMs: number;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();

  /** The clock is injected so tests assert expiry without sleeping (CLAUDE.md §2). */
  constructor(private readonly now: () => number = Date.now) {}

  /** Records one request against `key` and reports whether it may proceed. */
  hit(key: string, rule: RateLimitRule): RetryAfterSeconds {
    const nowMs = this.now();
    const current = this.windows.get(key);

    if (current === undefined || current.resetAtMs <= nowMs) {
      this.prune(nowMs);
      this.windows.set(key, { count: 1, resetAtMs: nowMs + rule.windowSeconds * 1000 });
      return 0;
    }

    if (current.count >= rule.limit) {
      // Round up, and never report 0 — a "Retry-After: 0" invites an immediate retry that
      // is still going to be refused.
      return Math.max(1, Math.ceil((current.resetAtMs - nowMs) / 1000));
    }

    current.count += 1;
    return 0;
  }

  /**
   * Keeps the map bounded. Only runs when a new window opens, so the common path stays a
   * single lookup. If every tracked window is still live at the cap we are already under a
   * flood far larger than these rules were meant to absorb — dropping the table degrades
   * to "no limit for one window", which is the pre-existing behaviour, rather than letting
   * the process grow until it is killed.
   */
  private prune(nowMs: number): void {
    if (this.windows.size < MAX_TRACKED_KEYS) {
      return;
    }
    for (const [key, window] of this.windows) {
      if (window.resetAtMs <= nowMs) {
        this.windows.delete(key);
      }
    }
    if (this.windows.size >= MAX_TRACKED_KEYS) {
      this.windows.clear();
    }
  }
}
