import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../api/client";

/**
 * Server-state via TanStack Query (Appendix A). Salesforce data lives here as cache —
 * never in a global UI store — with retry/refetch handled by the query client.
 */
export function useDashboard(email: string) {
  return useQuery({
    queryKey: ["dashboard", email],
    queryFn: () => fetchDashboard(email),
    retry: false,
  });
}
