import { useQuery } from "@tanstack/react-query";
import { fetchOrder } from "../api/client";

/** One order's detail, keyed by id — same pattern as useDashboard. */
export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId as string),
    enabled: Boolean(orderId),
    retry: false,
  });
}
