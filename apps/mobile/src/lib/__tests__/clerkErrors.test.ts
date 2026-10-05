import { clerkErrorMessage } from "@/lib/clerkErrors";
import i18n from "@/lib/i18n";

jest.mock("@clerk/expo", () => ({ isClerkAPIResponseError: () => false }));

test("a request that never reached Clerk reads as a connection problem, not Clerk's URL", () => {
    const clerk = new Error(
        'Clerk: Network error at "https://clerk.example/v1/client" - TypeError',
    );
    const native = new TypeError("Network request failed");
    for (const error of [clerk, native]) {
        expect(clerkErrorMessage(error, "fallback")).toBe(
            i18n.t("mobile.common.authUnavailableBody"),
        );
    }
    expect(clerkErrorMessage("nope", "fallback")).toBe("fallback");
});
