import { useQuery } from "@tanstack/react-query";

import { api, ApiError } from "./api";

export const queryKeys = { me: ["me"] as const };

/** Retry transient failures once; never retry a 401, which already signs out. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
    if (error instanceof ApiError && error.status === 401) return false;
    return failureCount < 1;
}

export function useMe() {
    return useQuery({
        queryKey: queryKeys.me,
        queryFn: () => api.me().then((response) => response.user),
        staleTime: 60_000,
        retry: shouldRetry,
    });
}
