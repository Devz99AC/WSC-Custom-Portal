import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "../api/client";

/** Documents shared with the signed-in client — server state via TanStack Query. */
export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
    retry: false,
  });
}
