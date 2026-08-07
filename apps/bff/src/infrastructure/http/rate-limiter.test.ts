import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, type RateLimitRule } from "./rate-limiter.js";

const RULE: RateLimitRule = { limit: 3, windowSeconds: 900 };

/** Controllable clock — the limiter takes one so expiry is asserted without sleeping. */
function fakeClock(startMs = 1_000_000) {
  let now = startMs;
  return {
    now: () => now,
    advanceSeconds: (seconds: number) => {
      now += seconds * 1000;
    },
  };
}

describe("FixedWindowRateLimiter", () => {
  it("allows exactly `limit` requests, then reports how long to wait", () => {
    const limiter = new FixedWindowRateLimiter(fakeClock().now);

    expect(limiter.hit("email:a@b.com", RULE)).toBe(0);
    expect(limiter.hit("email:a@b.com", RULE)).toBe(0);
    expect(limiter.hit("email:a@b.com", RULE)).toBe(0);
    expect(limiter.hit("email:a@b.com", RULE)).toBe(900);
  });

  it("counts each key separately, so one client can't lock out another", () => {
    const limiter = new FixedWindowRateLimiter(fakeClock().now);

    for (let i = 0; i < RULE.limit; i += 1) {
      limiter.hit("email:a@b.com", RULE);
    }
    expect(limiter.hit("email:a@b.com", RULE)).toBeGreaterThan(0);
    expect(limiter.hit("email:other@b.com", RULE)).toBe(0);
  });

  it("reports the remaining window, not the whole one, while it is running down", () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter(clock.now);

    for (let i = 0; i < RULE.limit; i += 1) {
      limiter.hit("ip:1.2.3.4", RULE);
    }
    clock.advanceSeconds(600);
    expect(limiter.hit("ip:1.2.3.4", RULE)).toBe(300);
  });

  it("opens a fresh window once the old one expires", () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter(clock.now);

    for (let i = 0; i < RULE.limit; i += 1) {
      limiter.hit("ip:1.2.3.4", RULE);
    }
    expect(limiter.hit("ip:1.2.3.4", RULE)).toBeGreaterThan(0);

    clock.advanceSeconds(RULE.windowSeconds);
    expect(limiter.hit("ip:1.2.3.4", RULE)).toBe(0);
  });

  // A "Retry-After: 0" would tell the caller to retry immediately into another refusal.
  it("never reports a zero wait for a refused request", () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter(clock.now);

    for (let i = 0; i < RULE.limit; i += 1) {
      limiter.hit("ip:1.2.3.4", RULE);
    }
    clock.advanceSeconds(RULE.windowSeconds - 0.5);
    expect(limiter.hit("ip:1.2.3.4", RULE)).toBe(1);
  });
});
