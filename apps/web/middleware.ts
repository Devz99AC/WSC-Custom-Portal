import { next } from "@vercel/edge";

/**
 * Edge-level HTTP Basic Auth gate for the staging deploy (ACTION-PLAN Grupo A #6).
 * Runs before every request, including the /api and /auth rewrites to the BFF —
 * once the browser's native Basic Auth prompt is satisfied, it caches the
 * credentials per-origin and attaches them automatically to subsequent fetch/XHR
 * calls, so this does not interfere with the app's own session cookie (ADR-0005).
 * Remove this file (and the Vercel env vars) once the deploy is ready for real
 * public traffic behind its own auth, not a shared staging password.
 */
export const config = {
  matcher: "/:path*",
};

export default function middleware(request: Request): Response {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new Response(
      "Staging Basic Auth is not configured (BASIC_AUTH_USER / BASIC_AUTH_PASSWORD missing).",
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const [providedUser, providedPassword] = atob(authHeader.slice("Basic ".length)).split(":");
    if (providedUser === expectedUser && providedPassword === expectedPassword) {
      return next();
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="WSC Portal (staging)"' },
  });
}
