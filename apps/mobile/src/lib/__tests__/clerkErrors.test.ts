import { clerkErrorMessage } from "@/lib/clerkErrors";
import i18n, { setLocale } from "@/lib/i18n";

/** Stands in for Clerk's ClerkAPIResponseError: a status and Clerk's error list. */
class MockClerkError extends Error {
    constructor(
        readonly status: number,
        readonly errors: { code: string; longMessage?: string; meta?: { paramName?: string } }[],
    ) {
        super("Clerk said no");
    }
}

jest.mock("@clerk/expo", () => ({
    isClerkAPIResponseError: (error: unknown) => error instanceof MockClerkError,
}));

const clerk = (code: string, paramName?: string, status = 422) =>
    new MockClerkError(status, [
        { code, longMessage: `Clerk's English for ${code}`, meta: { paramName } },
    ]);

afterEach(async () => {
    await setLocale("en");
});

test("a request that never reached Clerk reads as a connection problem, not Clerk's URL", () => {
    const network = new Error(
        'Clerk: Network error at "https://clerk.example/v1/client" - TypeError',
    );
    const native = new TypeError("Network request failed");
    for (const error of [network, native]) {
        expect(clerkErrorMessage(error, "fallback")).toBe(
            i18n.t("mobile.common.authUnavailableBody"),
        );
    }
    expect(clerkErrorMessage("nope", "fallback")).toBe("fallback");
});

test("the errors learners meet are told in their language, not Clerk's English", async () => {
    const cases: [Error, string][] = [
        [clerk("form_password_incorrect"), "errorPasswordIncorrect"],
        [clerk("form_identifier_not_found"), "errorAccountNotFound"],
        [clerk("form_code_incorrect"), "errorCodeIncorrect"],
        [clerk("verification_expired"), "errorCodeExpired"],
        [clerk("verification_failed"), "errorCodeTooManyTries"],
        [clerk("form_identifier_exists", "email_address"), "errorEmailTaken"],
        [clerk("form_identifier_exists", "username"), "errorUsernameTaken"],
        [clerk("form_password_pwned"), "errorPasswordPwned"],
        [clerk("form_password_length_too_short"), "passwordMinLength"],
        [clerk("form_password_validation_failed"), "errorPasswordWeak"],
        [clerk("form_username_invalid_length"), "usernameHint"],
        [clerk("form_username_invalid_character"), "usernameHint"],
        [clerk("form_param_format_invalid", "email_address"), "errorEmailInvalid"],
        [clerk("form_param_format_invalid", "identifier"), "errorEmailInvalid"],
        [clerk("user_locked", undefined, 403), "errorAccountLocked"],
        [clerk("strategy_for_user_invalid"), "errorUseGoogle"],
        [clerk("anything", undefined, 429), "errorTooManyTries"],
    ];
    for (const locale of ["en", "ta"] as const) {
        await setLocale(locale);
        for (const [error, key] of cases) {
            const message = clerkErrorMessage(error, "fallback");
            expect({ key, message }).toEqual({
                key,
                message: i18n.t(`mobile.auth.${key}`, { locale }),
            });
            expect(message).not.toMatch(/Clerk's English/);
        }
    }
    // Really in Tamil, not an English fallback.
    await setLocale("ta");
    expect(clerkErrorMessage(clerk("form_password_incorrect"), "fallback")).toMatch(/[஀-௿]/);
});

test("anything else is the screen's own message, never Clerk's or JavaScript's English", () => {
    expect(clerkErrorMessage(clerk("form_param_nil", "password"), "fallback")).toBe("fallback");
    expect(clerkErrorMessage(new MockClerkError(500, []), "fallback")).toBe("fallback");
    expect(clerkErrorMessage(new Error("undefined is not a function"), "fallback")).toBe(
        "fallback",
    );
});
