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

/**
 * The errors learners actually meet, by Clerk's code, as `mobile.auth` keys.
 * Clerk's own messages are English, and a learner reading the sign-in screen in
 * Tamil is the one who most needs to know the password was wrong.
 */
const MESSAGES: Record<string, string> = {
    form_password_incorrect: "errorPasswordIncorrect",
    form_identifier_not_found: "errorAccountNotFound",
    form_code_incorrect: "errorCodeIncorrect",
    verification_expired: "errorCodeExpired",
    // Clerk's answer once too many wrong codes have been tried.
    verification_failed: "errorCodeTooManyTries",
    form_password_pwned: "errorPasswordPwned",
    form_password_compromised: "errorPasswordPwned",
    form_password_length_too_short: "passwordMinLength",
    form_password_validation_failed: "errorPasswordWeak",
    form_password_not_strong_enough: "errorPasswordWeak",
    form_username_invalid_length: "usernameHint",
    form_username_invalid_character: "usernameHint",
    too_many_requests: "errorTooManyTries",
    user_locked: "errorAccountLocked",
    // A password sign-in for an account made with Google.
    strategy_for_user_invalid: "errorUseGoogle",
};

type ClerkApiError = { code: string; meta?: { paramName?: string } };

function messageKey({ code, meta }: ClerkApiError): string | undefined {
    if (code === "form_identifier_exists") {
        return meta?.paramName === "username" ? "errorUsernameTaken" : "errorEmailTaken";
    }
    // Sign-in names its email field "identifier"; sign-up names it "email_address".
    if (
        code === "form_param_format_invalid" &&
        (meta?.paramName === "email_address" || meta?.paramName === "identifier")
    ) {
        return "errorEmailInvalid";
    }
    return MESSAGES[code];
}

/**
 * What to tell the learner about a failed sign-in, sign-up or account change,
 * in the app's language. Anything not listed above gets `fallback` (the
 * screen's own "something went wrong"), never Clerk's English.
 */
export function clerkErrorMessage(error: unknown, fallback: string): string {
    if (isClerkAPIResponseError(error)) {
        if (error.status === 429) return i18n.t("mobile.auth.errorTooManyTries");
        const first = error.errors?.[0];
        const key = first && messageKey(first);
        if (key) return i18n.t(`mobile.auth.${key}`);
        if (__DEV__) console.warn("Clerk error with no message of ours", first?.code, error);
        return fallback;
    }
    if (isNetworkFailure(error)) return i18n.t("mobile.common.authUnavailableBody");
    return fallback;
}
