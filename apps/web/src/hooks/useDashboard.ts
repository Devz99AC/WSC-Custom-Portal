import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../api/client";

/**
 * Server-state via TanStack Query (Appendix A). Salesforce data lives here as cache —
 * never in a global UI store — with retry/refetch handled by the query client. Identity
 * comes from the session cookie, not a param — see api/client.ts. Callers distinguish
 * "not signed in" from a real error via `error instanceof UnauthorizedError`.
 */
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    retry: false,
  });
}
