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

describe("the learner's first language", () => {
    it("sends the choice and gives back what the server now holds", async () => {
        renderHook(() => useApiAuth());
        const saved = api.saveFirstLanguage({
            language: "bn",
            updatedAt: "2026-09-18T10:00:00.000Z",
        });
        await act(async () => {});

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/v1/me/first-language"),
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ language: "bn", updatedAt: "2026-09-18T10:00:00.000Z" }),
            }),
        );
        respond({ firstLanguage: "bn", firstLanguageUpdatedAt: "2026-09-18T10:00:00.000Z" });
        await expect(saved).resolves.toEqual({
            firstLanguage: "bn",
            firstLanguageUpdatedAt: "2026-09-18T10:00:00.000Z",
        });
    });
});

describe("translating one held word", () => {
    /** A fetch that only ever ends when the request is cancelled. */
    function neverAnswers() {
        globalThis.fetch = jest.fn(
            (_url, init) =>
                new Promise((_resolve, reject) => {
                    (init as RequestInit).signal?.addEventListener("abort", () => {
                        const error = new Error("Aborted");
                        error.name = "AbortError";
                        reject(error);
                    });
                }),
        ) as unknown as typeof fetch;
    }

    it("posts the word with the sentence it was held in", async () => {
        renderHook(() => useApiAuth());
        const request = api.translate({
            word: "platform",
            context: "Which platform for Jurong East?",
            language: "bn",
        });
        await act(async () => {});

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/v1/translate"),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    word: "platform",
                    context: "Which platform for Jurong East?",
                    language: "bn",
                }),
            }),
        );
        respond({ word: "platform", translation: "প্ল্যাটফর্ম", phrase: null });
        await expect(request).resolves.toMatchObject({ translation: "প্ল্যাটফর্ম" });
    });

    it("gives up after twelve seconds, because a finger is being held on the word", async () => {
        jest.useFakeTimers();
        neverAnswers();
        renderHook(() => useApiAuth());
        const request = api.translate({ word: "platform", context: "", language: "bn" });
        await act(async () => {});

        jest.advanceTimersByTime(11_999);
        jest.advanceTimersByTime(1);
        await expect(request).rejects.toThrow("The request timed out");
        jest.useRealTimers();
    });

    it("hands a caller their own cancellation back, not a network error", async () => {
        neverAnswers();
        renderHook(() => useApiAuth());
        const controller = new AbortController();
        const request = api.translate(
            { word: "platform", context: "", language: "bn" },
            { signal: controller.signal },
        );
        await act(async () => {});

        controller.abort();
        await expect(request).rejects.toMatchObject({ name: "AbortError" });
    });
});
