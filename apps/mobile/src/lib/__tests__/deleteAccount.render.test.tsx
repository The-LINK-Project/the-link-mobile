/**
 * Deleting an account from the phone.
 *
 * The server deletes the account before it answers, so on a weak connection
 * the deletion can happen with no answer reaching the phone. "All your data
 * will be removed" includes what is on this phone, so the phone's copy must go
 * then too, and must not go while the account is still there.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen, userEvent } from "@testing-library/react-native";

import DeleteAccountScreen from "@/app/(app)/delete-account";
import { api, ApiError } from "@/lib/api";
import i18n, { setLocale } from "@/lib/i18n";
import {
    completeLesson,
    flushProgress,
    loadProgress,
    resetProgressForTests,
} from "@/lib/progress/store";

jest.mock("expo-router", () => ({
    useRouter: () => ({ back: jest.fn() }),
    Stack: { Screen: () => null },
}));

const mockClerk = {
    user: { id: "user_a", reload: jest.fn() } as { id: string; reload: jest.Mock } | null,
    signOut: jest.fn(async () => undefined),
};
jest.mock("@clerk/expo", () => ({
    useClerk: () => mockClerk,
    useAuth: () => ({ getToken: async () => "token" }),
    isClerkAPIResponseError: (error: unknown) =>
        (error as { clerkError?: boolean } | null)?.clerkError === true,
}));

jest.mock("@/lib/api", () => {
    class ApiError extends Error {
        status: number;
        sent = true;
        constructor(status: number, message: string) {
            super(message);
            this.status = status;
        }
    }
    return { ApiError, api: { deleteAccount: jest.fn() } };
});

const deleteAccount = api.deleteAccount as jest.Mock;
const KEY = "link.progress.v1.user_a";
const text = (key: string) => i18n.t(key, { locale: "en" });
/** Clerk's own answer when the account it is asked about no longer exists. */
const gone = Object.assign(new Error("not found"), { clerkError: true, status: 404 });

beforeEach(async () => {
    await AsyncStorage.clear();
    resetProgressForTests();
    await act(() => setLocale("en"));
    deleteAccount.mockReset();
    mockClerk.user = { id: "user_a", reload: jest.fn(async () => undefined) };
    mockClerk.signOut.mockClear();
    await loadProgress("user_a");
    completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
    await flushProgress();
});

async function pressDelete(user: ReturnType<typeof userEvent.setup>) {
    await user.press(screen.getByRole("button", { name: text("mobile.account.deleteConfirm") }));
}

async function confirm() {
    const user = userEvent.setup();
    render(<DeleteAccountScreen />);
    await user.type(screen.getByLabelText(text("mobile.foundation.deleteTyped")), "DELETE");
    return user;
}

it("erases the phone's copy once the server has deleted the account", async () => {
    deleteAccount.mockResolvedValue({ success: true, cleanupPending: false });
    const user = await confirm();
    await pressDelete(user);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(mockClerk.signOut).toHaveBeenCalled();
});

it("erases it when the answer was lost but Clerk says the account is gone", async () => {
    deleteAccount.mockRejectedValue(new ApiError(0, "The request timed out"));
    mockClerk.user!.reload.mockRejectedValue(gone);
    const user = await confirm();
    await pressDelete(user);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(mockClerk.signOut).toHaveBeenCalled();
});

it("erases it when a try after a lost answer finds the session already ended", async () => {
    // The answer is lost and Clerk cannot be reached to ask.
    deleteAccount.mockRejectedValueOnce(new ApiError(0, "The request timed out"));
    mockClerk.user!.reload.mockRejectedValue(new Error("Network request failed"));
    const user = await confirm();
    await pressDelete(user);
    const error = screen.getByText(text("mobile.account.deleteFailed"));
    expect(error.props.accessibilityRole).toBe("alert");
    expect(error.props.accessibilityLiveRegion).toBe("polite");
    expect(await AsyncStorage.getItem(KEY)).not.toBeNull();

    // Trying again: the account went with that first try, so the session is gone.
    deleteAccount.mockRejectedValueOnce(new ApiError(401, "Authentication required"));
    mockClerk.user = null;
    await pressDelete(user);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(screen.queryByText(text("mobile.account.deleteFailed"))).toBeNull();
});

it("keeps it while the account is still there", async () => {
    deleteAccount.mockRejectedValue(new ApiError(0, "Network error"));
    const user = await confirm();
    await pressDelete(user);
    expect(mockClerk.user!.reload).toHaveBeenCalled();
    expect(screen.getByText(text("mobile.account.deleteFailed"))).toBeTruthy();
    expect(await AsyncStorage.getItem(KEY)).not.toBeNull();
    expect(mockClerk.signOut).not.toHaveBeenCalled();
});

it("keeps it when the session had ended before any delete was sent", async () => {
    deleteAccount.mockRejectedValue(new ApiError(401, "Authentication required"));
    const user = await confirm();
    await pressDelete(user);
    expect(await AsyncStorage.getItem(KEY)).not.toBeNull();
});

it("keeps it when a refusal follows a try that never left the phone", async () => {
    // Offline: no sign-in token, so the delete was never sent.
    const unsent = Object.assign(new ApiError(0, "Could not connect to sign-in service"), {
        sent: false,
    });
    deleteAccount.mockRejectedValueOnce(unsent);
    mockClerk.user!.reload.mockRejectedValue(new Error("Network request failed"));
    const user = await confirm();
    await pressDelete(user);
    expect(screen.getByText(text("mobile.account.deleteFailed"))).toBeTruthy();

    // Later the session has ended for another reason (a password changed on the
    // website): the account is still there, and so is what was on this phone.
    deleteAccount.mockRejectedValueOnce(new ApiError(401, "Authentication required"));
    await pressDelete(user);
    expect(await AsyncStorage.getItem(KEY)).not.toBeNull();
    expect(mockClerk.signOut).not.toHaveBeenCalled();
});
