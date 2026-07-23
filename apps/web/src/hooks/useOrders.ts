import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "../api/client";

/** "My Orders" list — server state via TanStack Query, same pattern as useDashboard. */
export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    retry: false,
  });
}
