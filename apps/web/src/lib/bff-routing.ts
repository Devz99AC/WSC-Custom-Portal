/**
 * Which BFF a deployment is allowed to talk to.
 *
 * `vercel.json` cannot read environment variables — there is no `"destination": "$VAR"` —
 * so the Railway URL is written into it literally, and **every** deployment inherits it.
 * That is why a Vercel preview built from any branch has been talking to the production
 * BFF, and through it to real client data in production Salesforce.
 *
 * The decision lives here, apart from `middleware.ts`, because the middleware itself can
 * only be exercised by deploying it, and this is the part that must be right.
 */

export type BffRoute =
  /** Leave the request alone; `vercel.json`'s literal rewrite handles it. */
  | { action: "inherit" }
  | { action: "rewrite"; destination: string }
  /** Refuse to serve the API at all. */
  | { action: "blocked"; reason: string };

export interface BffRoutingEnv {
  /** Vercel's own `VERCEL_ENV`: "production" | "preview" | "development". */
  vercelEnv: string | undefined;
  /** Per-environment override, set in the Vercel dashboard. */
  bffOrigin: string | undefined;
}

/**
 * Deliberately asymmetric, and the asymmetry is the point.
 *
 * **Production inherits.** It keeps working off the declarative rewrite it has always
 * used, so a missing or fat-fingered `BFF_ORIGIN` cannot take down a portal that is
 * serving real clients. This file is incapable of breaking production.
 *
 * **Everything else fails closed.** An unconfigured preview gets a 503 rather than
 * quietly inheriting production's backend. That trade is the whole reason this exists:
 * a preview that doesn't work is a nuisance someone fixes in a minute, whereas a preview
 * that works *against production Salesforce* is invisible until it has already written
 * or leaked something.
 */
export function resolveBffRoute({ vercelEnv, bffOrigin }: BffRoutingEnv): BffRoute {
  if (vercelEnv === "production") {
    return { action: "inherit" };
  }

  const origin = bffOrigin?.trim();
  if (!origin) {
    return {
      action: "blocked",
      reason:
        `This ${vercelEnv ?? "non-production"} deployment has no BFF_ORIGIN set, so it has ` +
        "no backend of its own. It will not fall back to production.",
    };
  }

  // A relative or malformed value would silently resolve against the preview's own host
  // and 404 — confusing, and it hides the misconfiguration. Say so instead.
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return { action: "blocked", reason: `BFF_ORIGIN is not a valid absolute URL: "${origin}".` };
  }
  if (parsed.protocol !== "https:") {
    return { action: "blocked", reason: `BFF_ORIGIN must be https, got "${parsed.protocol}".` };
  }

  return { action: "rewrite", destination: parsed.origin };
}

/** Joins the resolved origin back onto the incoming path. Kept with the rule above so the
 *  query string can't be dropped — the magic link carries its token there. */
export function bffDestination(origin: string, requestUrl: string): string {
  const incoming = new URL(requestUrl);
  return `${origin}${incoming.pathname}${incoming.search}`;
}
