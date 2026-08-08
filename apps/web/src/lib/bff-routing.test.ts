import { describe, expect, it } from "vitest";
import { bffDestination, resolveBffRoute } from "./bff-routing";

const STAGING = "https://wscbff-staging.up.railway.app";

describe("resolveBffRoute", () => {
  /**
   * The whole point of the asymmetry: production must keep working off the declarative
   * rewrite it has always used, so a missing or mistyped BFF_ORIGIN cannot take down a
   * portal that is serving real clients.
   */
  it("leaves production alone even when BFF_ORIGIN is missing or wrong", () => {
    expect(resolveBffRoute({ vercelEnv: "production", bffOrigin: undefined })).toEqual({
      action: "inherit",
    });
    expect(resolveBffRoute({ vercelEnv: "production", bffOrigin: "not-a-url" })).toEqual({
      action: "inherit",
    });
  });

  it("sends a configured preview to its own backend", () => {
    expect(resolveBffRoute({ vercelEnv: "preview", bffOrigin: STAGING })).toEqual({
      action: "rewrite",
      destination: STAGING,
    });
  });

  /**
   * The defect this file exists to fix: an unconfigured preview used to inherit
   * production's backend and talk to real Salesforce data, working perfectly and looking
   * completely normal. A 503 is the correct outcome.
   */
  it("blocks an unconfigured preview instead of falling back to production", () => {
    const route = resolveBffRoute({ vercelEnv: "preview", bffOrigin: undefined });

    expect(route.action).toBe("blocked");
    expect(route).not.toMatchObject({ action: "inherit" });
  });

  it("treats an empty or whitespace value as unset, not as a valid origin", () => {
    expect(resolveBffRoute({ vercelEnv: "preview", bffOrigin: "   " }).action).toBe("blocked");
  });

  // A relative value would resolve against the preview's own host and 404, which reads
  // like an app bug rather than the misconfiguration it is.
  it("rejects a value that isn't an absolute URL", () => {
    expect(resolveBffRoute({ vercelEnv: "preview", bffOrigin: "/api" }).action).toBe("blocked");
  });

  it("refuses a plain-http backend — the session cookie is Secure", () => {
    expect(resolveBffRoute({ vercelEnv: "preview", bffOrigin: "http://staging" }).action).toBe(
      "blocked",
    );
  });

  it("keeps an unknown environment on the safe side of the fence", () => {
    expect(resolveBffRoute({ vercelEnv: undefined, bffOrigin: undefined }).action).toBe("blocked");
  });

  it("discards any path on the origin, keeping only scheme and host", () => {
    expect(resolveBffRoute({ vercelEnv: "preview", bffOrigin: `${STAGING}/api/` })).toEqual({
      action: "rewrite",
      destination: STAGING,
    });
  });
});

describe("bffDestination", () => {
  it("carries the path through", () => {
    expect(bffDestination(STAGING, "https://preview.vercel.app/api/orders")).toBe(
      `${STAGING}/api/orders`,
    );
  });

  // The magic link's token lives in the query string — dropping it breaks every sign-in.
  it("carries the query string through", () => {
    expect(bffDestination(STAGING, "https://preview.vercel.app/auth/verify?token=abc123")).toBe(
      `${STAGING}/auth/verify?token=abc123`,
    );
  });
});
