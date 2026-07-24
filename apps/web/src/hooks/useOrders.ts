import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "../api/client";

/** "My Orders" list — server state via TanStack Query. Also the app's top-level "who
 *  am I" fetch (auth gate + sidebar identity); see App.tsx. */
export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    retry: false,
  });
}
