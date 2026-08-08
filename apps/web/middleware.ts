import { next, rewrite } from "@vercel/edge";
import { bffDestination, resolveBffRoute } from "./src/lib/bff-routing";

/**
 * Sends `/api` and `/auth` to the right BFF for this deployment.
 *
 * It exists because `vercel.json` cannot read environment variables, so its rewrite
 * targets one hardcoded Railway URL and every deployment — production, preview, any
 * branch — inherited it. The rule itself lives in `src/lib/bff-routing.ts` and is unit
 * tested; this file is only the Vercel-shaped wrapper, because middleware can't be
 * exercised without deploying it.
 *
 * Note this is a *different* file from the Basic Auth middleware deleted on 2026-08-07
 * (`git show 0cc87d9:apps/web/middleware.ts`). It does not gate access — previews are
 * public. It only decides which backend they reach.
 *
 * Local `pnpm dev` never runs this: Vite proxies `/api` and `/auth` itself
 * (`vite.config.ts`), so nothing here affects development on your machine.
 */
export const config = {
  matcher: ["/api/:path*", "/auth/:path*"],
};

export default function middleware(request: Request): Response {
  const route = resolveBffRoute({
    vercelEnv: process.env.VERCEL_ENV,
    bffOrigin: process.env.BFF_ORIGIN,
  });

  if (route.action === "inherit") {
    return next();
  }

  if (route.action === "blocked") {
    // Plain text and 503 on purpose: this is a deployment misconfiguration aimed at
    // whoever opened the preview, not an application error for a client to interpret.
    return new Response(`WSC portal — backend not configured.\n\n${route.reason}\n`, {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return rewrite(bffDestination(route.destination, request.url));
}
