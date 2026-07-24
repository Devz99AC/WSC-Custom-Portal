import { useQuery } from "@tanstack/react-query";
import { fetchPayments } from "../api/client";

/** Cross-order payment history — same pattern as useOrders. */
export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: fetchPayments,
    retry: false,
  });
}
