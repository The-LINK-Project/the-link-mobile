/**
 * The steps of signing up and resetting a password that a learner can get
 * stuck between, against a model of Clerk's state.
 *
 * Clerk itself is not called. The model keeps the one rule that mattered: a
 * code is used up once Clerk has taken it, and asking about it again fails.
 */

import { act, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import ForgotPasswordScreen from "@/app/(auth)/forgot-password";
import SignUpScreen from "@/app/(auth)/sign-up";
import i18n, { setLocale } from "@/lib/i18n";

class MockClerkError extends Error {
    readonly status = 422;
    readonly errors: { code: string }[];
    constructor(code: string) {
        super(code);
        this.errors = [{ code }];
    }
}

type Result = Promise<{ error: MockClerkError | null }>;
const ok = async () => ({ error: null });

const mockClerk: { signIn: Record<string, unknown>; signUp: Record<string, unknown> } = {
    signIn: {},
    signUp: {},
};

jest.mock("@clerk/expo", () => ({
    useSignIn: () => ({ signIn: mockClerk.signIn, fetchStatus: "idle" }),
    useSignUp: () => ({ signUp: mockClerk.signUp, fetchStatus: "idle" }),
    isClerkAPIResponseError: (error: unknown) => error instanceof MockClerkError,
}));
jest.mock("expo-router", () => ({
    Link: ({ children }: { children: React.ReactNode }) => children,
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/lib/clerkSettings", () => ({
    USERNAME_PATTERN: /^[a-zA-Z0-9_-]{4,64}$/,
    useGoogleSignIn: () => false,
    useProfileAttributes: () => ({
        username: { enabled: false, required: false },
        firstName: { enabled: false, required: false },
        lastName: { enabled: false, required: false },
    }),
}));
jest.mock("@/components/auth/PrivacyNotice", () => ({ PrivacyNotice: () => null }));

const auth = (key: string, options?: Record<string, unknown>) =>
    i18n.t(`mobile.auth.${key}`, options);

let announce: jest.SpyInstance;
beforeEach(async () => {
    await act(() => setLocale("en"));
    announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation();
});
afterEach(() => announce.mockRestore());

/** Clerk's password reset by email code, as far as the screen can tell. */
function modelPasswordReset() {
    let codeTaken = false;
    const signIn = {
        status: "needs_identifier",
        create: jest.fn(async () => {
            signIn.status = "needs_first_factor";
            return { error: null };
        }),
        resetPasswordEmailCode: {
            sendCode: jest.fn(ok),
            verifyCode: jest.fn(async (): Result => {
                if (codeTaken) return { error: new MockClerkError("verification_failed") };
                codeTaken = true;
                signIn.status = "needs_new_password";
                return { error: null };
            }),
            submitPassword: jest.fn(async ({ password }: { password: string }): Result => {
                // Found in a breach: Clerk refuses it and keeps waiting for another.
                if (password === "breached1") {
                    return { error: new MockClerkError("form_password_pwned") };
                }
                signIn.status = "complete";
                return { error: null };
            }),
        },
        finalize: jest.fn(ok),
    };
    mockClerk.signIn = signIn;
    return signIn;
}

it("saves a second new password after Clerk refused the first", async () => {
    const signIn = modelPasswordReset();
    const user = userEvent.setup();
    render(<ForgotPasswordScreen />);

    await user.type(screen.getByLabelText(auth("email")), "learner@example.com");
    await user.press(screen.getByLabelText(auth("sendCode")));
    await user.type(screen.getByLabelText(auth("code")), "123456");
    await user.type(screen.getByLabelText(auth("newPassword")), "breached1");
    await user.press(screen.getByLabelText(auth("resetPassword")));

    // Told why, in their language, out loud as well as on screen.
    expect(screen.getByText(auth("errorPasswordPwned"))).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(auth("errorPasswordPwned"));

    await user.clear(screen.getByLabelText(auth("newPassword")));
    await user.type(screen.getByLabelText(auth("newPassword")), "a-better-one");
    await user.press(screen.getByLabelText(auth("resetPassword")));

    expect(signIn.resetPasswordEmailCode.verifyCode).toHaveBeenCalledTimes(1);
    expect(signIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledTimes(2);
    expect(signIn.finalize).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(auth("errorPasswordPwned"))).toBeNull();
});

/** Clerk's sign-up by email code. `finalizeFails` times, activating the session fails. */
function modelSignUp(start: Partial<Record<string, unknown>> = {}, finalizeFails = 0) {
    let fails = finalizeFails;
    const signUp = {
        status: null as string | null,
        emailAddress: null as string | null,
        unverifiedFields: [] as string[],
        ...start,
        password: jest.fn(async ({ emailAddress }: { emailAddress: string }) => {
            signUp.status = "missing_requirements";
            signUp.emailAddress = emailAddress;
            signUp.unverifiedFields = ["email_address"];
            return { error: null };
        }),
        verifications: {
            sendEmailCode: jest.fn(ok),
            verifyEmailCode: jest.fn(async (): Result => {
                if (!signUp.unverifiedFields.includes("email_address")) {
                    return { error: new MockClerkError("verification_failed") };
                }
                signUp.unverifiedFields = [];
                signUp.status = "complete";
                return { error: null };
            }),
        },
        finalize: jest.fn(async (): Result => {
            if (fails > 0) {
                fails--;
                return { error: new MockClerkError("network_error_of_some_kind") };
            }
            return { error: null };
        }),
    };
    mockClerk.signUp = signUp;
    return signUp;
}

it("activates a verified sign-up on a second try without checking the used code again", async () => {
    const signUp = modelSignUp({}, 1);
    const user = userEvent.setup();
    render(<SignUpScreen />);

    await user.type(screen.getByLabelText(auth("email")), "new@example.com");
    await user.type(screen.getByLabelText(auth("password")), "long-enough");
    await user.press(screen.getByLabelText(auth("signUp")));
    await user.type(screen.getByLabelText(auth("code")), "123456");
    await user.press(screen.getByLabelText(auth("verify")));

    // Clerk's English never shows; the screen's own message does.
    expect(screen.getByText(auth("genericError"))).toBeTruthy();

    await user.press(screen.getByLabelText(auth("verify")));
    expect(signUp.verifications.verifyEmailCode).toHaveBeenCalledTimes(1);
    expect(signUp.finalize).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(auth("genericError"))).toBeNull();
});

it("comes back to the code it is waiting for after Android closed the app", () => {
    modelSignUp({
        status: "missing_requirements",
        emailAddress: "waiting@example.com",
        unverifiedFields: ["email_address"],
    });
    render(<SignUpScreen />);

    expect(screen.getByText(auth("verifyTitle"))).toBeTruthy();
    expect(screen.getByText(auth("verifyBody", { email: "waiting@example.com" }))).toBeTruthy();
    expect(screen.getByLabelText(auth("code"))).toBeTruthy();
});

it("starts with the form when no sign-up is waiting", () => {
    modelSignUp();
    render(<SignUpScreen />);

    expect(screen.getByLabelText(auth("email"))).toBeTruthy();
    expect(screen.queryByText(auth("verifyTitle"))).toBeNull();
});

it("lets a learner leave a waiting sign-up for another email", async () => {
    modelSignUp({
        status: "missing_requirements",
        emailAddress: "waiting@example.com",
        unverifiedFields: ["email_address"],
    });
    const user = userEvent.setup();
    render(<SignUpScreen />);

    await user.press(screen.getByLabelText(auth("changeEmail")));
    expect(screen.getByLabelText(auth("email")).props.value).toBe("waiting@example.com");
    expect(screen.queryByText(auth("verifyTitle"))).toBeNull();
});
