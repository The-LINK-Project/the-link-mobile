import { act, renderHook } from "@testing-library/react-native";

import { api, useApiAuth } from "@/lib/api";

const mockAuth = {
    getToken: jest.fn(),
    isSignedIn: true,
    signOut: jest.fn(),
    userId: "user_a" as string | null,
};

jest.mock("@clerk/expo", () => ({
    useAuth: () => mockAuth,
    isClerkAPIResponseError: () => false,
}));

const realFetch = globalThis.fetch;
let respond: (body: unknown) => void;

beforeEach(() => {
    mockAuth.getToken = jest.fn().mockResolvedValue("token-1");
    mockAuth.userId = "user_a";
    globalThis.fetch = jest.fn(
        () =>
            new Promise((resolve) => {
                respond = (body) => resolve({ ok: true, status: 200, json: async () => body });
            }),
    ) as unknown as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

/** Starts a request and returns once it is waiting on the network. */
async function startRequest() {
    const request = api.me();
    await act(async () => {});
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    // Wrapped, because awaiting a returned promise would also wait for the response.
    return { request };
}

describe("API client sign-in bridge", () => {
    it("keeps a slow response when Clerk refreshes the session token mid-request", async () => {
        const { rerender } = renderHook(() => useApiAuth());
        const { request } = await startRequest();

        // A refreshed token arrives as a new function for the same account.
        mockAuth.getToken = jest.fn().mockResolvedValue("token-2");
        rerender({});
        respond({ user: { clerkId: "user_a" } });

        await expect(request).resolves.toEqual({ user: { clerkId: "user_a" } });
    });

    it("still discards a response when the signed-in account changes mid-request", async () => {
        const { rerender } = renderHook(() => useApiAuth());
        const { request } = await startRequest();

        mockAuth.userId = "user_b";
        rerender({});
        respond({ user: { clerkId: "user_a" } });

        await expect(request).rejects.toThrow("Account changed");
    });
});
