import { isClerkAPIResponseError } from "@clerk/expo";

import i18n from "@/lib/i18n";

/**
 * Clerk's own test for a request that never reached it, plus React Native's
 * wording for the same failure. Its message is English with a URL in it.
 */
function isNetworkFailure(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const text = `${error.message}${error.name}`.toLowerCase().replace(/\s+/g, "");
    return text.includes("networkerror") || text.includes("networkrequestfailed");
}

/** Human-readable message from a Clerk error, or the given fallback. */
export function clerkErrorMessage(error: unknown, fallback: string): string {
    if (isClerkAPIResponseError(error)) {
        const first = error.errors?.[0];
        return first?.longMessage || first?.message || fallback;
    }
    if (isNetworkFailure(error)) return i18n.t("mobile.common.authUnavailableBody");
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}
