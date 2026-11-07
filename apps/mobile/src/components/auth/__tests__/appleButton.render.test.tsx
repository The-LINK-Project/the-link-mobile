/**
 * "Continue with Apple" against models of Apple's sheet and Clerk's legacy
 * sign-in and sign-up resources. Neither Apple nor Clerk is called.
 */

import { act, render, screen, userEvent } from "@testing-library/react-native";

import { AppleButton } from "@/components/auth/AppleButton";
import i18n, { setLocale } from "@/lib/i18n";

class MockClerkError extends Error {
    readonly status = 422;
    readonly errors: { code: string }[];
    constructor(code: string) {
        super(code);
        this.errors = [{ code }];
    }
}

const mockApple = { signInAsync: jest.fn() };
const mockClerk: {
    signIn: Record<string, unknown>;
    signUp: Record<string, unknown>;
    setActive: jest.Mock;
} = { signIn: {}, signUp: {}, setActive: jest.fn() };

jest.mock("expo-apple-authentication", () => ({
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    signInAsync: (...args: unknown[]) => mockApple.signInAsync(...args),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => "nonce-1" }));
jest.mock("@clerk/expo/legacy", () => ({
    useSignIn: () => ({ signIn: mockClerk.signIn, setActive: mockClerk.setActive, isLoaded: true }),
    useSignUp: () => ({ signUp: mockClerk.signUp, isLoaded: true }),
}));
jest.mock("@clerk/expo", () => ({
    isClerkAPIResponseError: (error: unknown) => error instanceof MockClerkError,
}));
jest.mock("@/lib/clerkSettings", () => ({ USERNAME_PATTERN: /^[a-zA-Z0-9_-]{4,64}$/ }));

const auth = (key: string) => i18n.t(`mobile.auth.${key}`);
const TITLE = "Continue with Apple";

function appleAnswers(fullName: { givenName: string; familyName: string } | null) {
    mockApple.signInAsync.mockResolvedValue({ identityToken: "apple-token", fullName });
}

/** A Clerk sign-up that, once created from Apple's token, is in `state`. */
function modelSignUp(state: {
    status: string;
    missingFields?: string[];
    createdSessionId?: string | null;
    externalAccountStatus?: string;
}) {
    const created = {
        status: state.status,
        missingFields: state.missingFields ?? [],
        createdSessionId: state.createdSessionId ?? null,
        verifications: { externalAccount: { status: state.externalAccountStatus ?? "verified" } },
        update: jest.fn(async () => ({
            status: "complete",
            createdSessionId: "sess-after-update",
        })),
    };
    const signUp = { create: jest.fn(async () => created) };
    mockClerk.signUp = signUp;
    return { signUp, created };
}

let onError: jest.Mock;
beforeEach(async () => {
    await act(() => setLocale("en"));
    onError = jest.fn();
    mockApple.signInAsync.mockReset();
    mockClerk.setActive = jest.fn();
    mockClerk.signIn = { create: jest.fn() };
});

it("signs a new learner up with the name Apple shares", async () => {
    appleAnswers({ givenName: "Mei", familyName: "Tan" });
    const { signUp } = modelSignUp({ status: "complete", createdSessionId: "sess-new" });
    const user = userEvent.setup();
    render(<AppleButton title={TITLE} onError={onError} />);

    await user.press(screen.getByLabelText(TITLE));

    expect(signUp.create).toHaveBeenCalledWith({
        strategy: "oauth_token_apple",
        token: "apple-token",
        firstName: "Mei",
        lastName: "Tan",
    });
    expect(mockClerk.setActive).toHaveBeenCalledWith({ session: "sess-new" });
    expect(onError).not.toHaveBeenCalled();
});

it("signs an existing Apple account in instead of making a second one", async () => {
    // Apple shares the name only on the first sign-in
    appleAnswers(null);
    modelSignUp({ status: "missing_requirements", externalAccountStatus: "transferable" });
    const signIn = { create: jest.fn(async () => ({ createdSessionId: "sess-existing" })) };
    mockClerk.signIn = signIn;
    const user = userEvent.setup();
    render(<AppleButton title={TITLE} onError={onError} />);

    await user.press(screen.getByLabelText(TITLE));

    expect(signIn.create).toHaveBeenCalledWith({ transfer: true });
    expect(mockClerk.setActive).toHaveBeenCalledWith({ session: "sess-existing" });
    expect(onError).not.toHaveBeenCalled();
});

it("asks only for the username Clerk still needs, then finishes the sign-up", async () => {
    appleAnswers({ givenName: "Mei", familyName: "Tan" });
    const { created } = modelSignUp({
        status: "missing_requirements",
        missingFields: ["username"],
    });
    const user = userEvent.setup();
    render(<AppleButton title={TITLE} onError={onError} />);

    await user.press(screen.getByLabelText(TITLE));

    expect(screen.getByLabelText(auth("username"))).toBeTruthy();
    expect(screen.queryByLabelText(auth("firstName"))).toBeNull();
    expect(mockClerk.setActive).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(auth("username")), "mei_tan");
    await user.press(screen.getByLabelText(auth("signUp")));

    expect(created.update).toHaveBeenCalledWith({ username: "mei_tan" });
    expect(mockClerk.setActive).toHaveBeenCalledWith({ session: "sess-after-update" });
});

it("says nothing when the learner closes Apple's sheet", async () => {
    mockApple.signInAsync.mockRejectedValue(
        Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" }),
    );
    const { signUp } = modelSignUp({ status: "complete" });
    const user = userEvent.setup();
    render(<AppleButton title={TITLE} onError={onError} />);

    await user.press(screen.getByLabelText(TITLE));

    expect(signUp.create).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(screen.getByLabelText(TITLE)).toBeTruthy();
});

it("explains a refusal from Clerk in the app's own words", async () => {
    appleAnswers({ givenName: "Mei", familyName: "Tan" });
    mockClerk.signUp = {
        create: jest.fn(async () => {
            throw new MockClerkError("too_many_requests");
        }),
    };
    const user = userEvent.setup();
    render(<AppleButton title={TITLE} onError={onError} />);

    await user.press(screen.getByLabelText(TITLE));

    expect(onError).toHaveBeenCalledWith(auth("errorTooManyTries"));
    expect(mockClerk.setActive).not.toHaveBeenCalled();
});

it("reports a sign-in Apple answered but Clerk could not finish", async () => {
    appleAnswers(null);
    modelSignUp({ status: "abandoned" });
    const user = userEvent.setup();
    render(<AppleButton title={TITLE} onError={onError} />);

    await user.press(screen.getByLabelText(TITLE));

    expect(onError).toHaveBeenCalledWith(auth("genericError"));
});
