import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
export const queryKeys = { me: ["me"] as const };
export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api.me().then(r => r.user), staleTime: 60000 });
}

