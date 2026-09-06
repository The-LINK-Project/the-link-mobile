import { isClerkAPIResponseError } from "@clerk/expo";

/** Human-readable message from a Clerk error, or the given fallback. */
export function clerkErrorMessage(error: unknown, fallback: string): string {
    if (isClerkAPIResponseError(error)) {
        const first = error.errors?.[0];
        return first?.longMessage || first?.message || fallback;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}
