import { isClerkAPIResponseError, useAuth } from "@clerk/expo";
import { useLayoutEffect, useState } from "react";

import type { FirstLanguage, TranslationLanguage } from "@/lib/firstLanguage/languages";
import type { Progress } from "@/lib/progress/model";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;
// Bumped whenever the signed-in user changes, so in-flight requests started
// under a previous account are discarded instead of resolving into the new one.
let authGeneration = 0;
/** The account the current generation belongs to. */
let authAccount: string | null | undefined;

// Called when the API answers 401 while we believed we were signed in —
// the session was revoked or expired underneath us. Registered by useApiAuth.
let onUnauthorized: (() => void) | null = null;

/**
 * Wires Clerk's getToken into the client. Mount once, inside ClerkProvider
 * and the query provider.
 */
export function useApiAuth() {
    const { getToken: clerkGetToken, isSignedIn, signOut, userId } = useAuth();
    const [readyFor, setReadyFor] = useState<string | null | undefined>(undefined);
    useLayoutEffect(() => {
        // Only a different account invalidates requests in flight. Clerk also
        // hands out new functions when it refreshes a session token, and treating
        // that as an account switch discarded any response slower than a refresh.
        const account = isSignedIn ? (userId ?? null) : null;
        if (account !== authAccount) {
            ++authGeneration;
            authAccount = account;
        }
        getToken = isSignedIn ? () => clerkGetToken() : async () => null;
        onUnauthorized = isSignedIn
            ? () => {
                  void signOut().catch(() => undefined);
              }
            : null;
        // Children must wait until the imperative token bridge is installed.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReadyFor(userId ?? null);
    }, [clerkGetToken, isSignedIn, signOut, userId]);
    useLayoutEffect(
        () => () => {
            ++authGeneration;
            authAccount = undefined;
            getToken = async () => null;
            onUnauthorized = null;
        },
        [],
    );
    return readyFor !== undefined && readyFor === (userId ?? null);
}

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public body?: unknown,
    ) {
        super(message);
    }
}

type RequestOptions = {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    /** Request deadline in milliseconds. */
    timeoutMs?: number;
    /**
     * The caller's own cancellation, for work a screen can walk away from. An
     * abort through this signal comes back as the abort itself rather than as
     * an ApiError, so the caller can tell "I cancelled this" from "the network
     * failed" without inspecting messages.
     */
    signal?: AbortSignal;
};

async function request<T>(
    path: string,
    { method = "GET", body, timeoutMs = 20_000, signal }: RequestOptions = {},
): Promise<T> {
    const generation = authGeneration;
    let token: string | null;
    try {
        token = await getToken();
    } catch (error) {
        // Clerk can reject before fetch when a deleted/revoked session is
        // restored from SecureStore. That must take the same path as API 401.
        const expired =
            isClerkAPIResponseError(error) && (error.status === 401 || error.status === 404);
        if (expired && generation === authGeneration) onUnauthorized?.();
        throw new ApiError(
            expired ? 401 : 0,
            expired ? "Authentication required" : "Could not connect to sign-in service",
        );
    }
    if (generation !== authGeneration) throw new ApiError(0, "Account changed");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // The caller's signal is folded into the deadline's controller rather than
    // handed to fetch, so the timeout keeps working exactly as it did and only
    // one of the two has to win.
    const abort = () => controller.abort();
    if (signal) {
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort);
    }

    let response: Response;
    let json: unknown = null;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: {
                Accept: "application/json",
                ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        try {
            json = await response.json();
        } catch (error) {
            if (controller.signal.aborted) throw error;
            if (response.ok) throw new ApiError(502, "Invalid server response");
        }
    } catch (error) {
        if (error instanceof ApiError) throw error;
        const aborted = (error as { name?: string })?.name === "AbortError";
        // A caller who cancelled on purpose gets their abort back: nobody is
        // waiting to be told that the request they dropped did not finish.
        if (aborted && signal?.aborted) throw error;
        throw new ApiError(0, aborted ? "The request timed out" : "Network error");
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
    }

    if (generation !== authGeneration) throw new ApiError(0, "Account changed");

    if (!response.ok) {
        const message =
            (json as { error?: string } | null)?.error ?? `Request failed (${response.status})`;
        // A 401 with a token we thought was valid means the session is gone;
        // drop it client-side so the user lands on sign-in instead of seeing
        // every screen fail
        if (response.status === 401 && token && generation === authGeneration && onUnauthorized) {
            onUnauthorized();
        }
        throw new ApiError(response.status, message, json);
    }

    if (!json || typeof json !== "object") throw new ApiError(502, "Invalid server response");
    return json as T;
}

// ---------------------------------------------------------------- payloads

export type ApiUser = {
    _id: string;
    clerkId: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    photo: string;
    /**
     * The language the learner reads best, as a first-language code. Absent
     * until they have chosen, and typed loosely on purpose: the server is free
     * to learn a new code before this app is updated, and the reader in
     * `firstLanguage/store` drops anything it does not know.
     */
    firstLanguage?: string;
    firstLanguageUpdatedAt?: string;
};

/** What the server holds for a learner's first language, after a merge. */
export type FirstLanguageResponse = {
    firstLanguage?: string;
    firstLanguageUpdatedAt?: string;
};

/** One word to put into the learner's language. Mirrors `POST /v1/translate`. */
export type TranslateRequest = {
    word: string;
    /** The sentence the word was held in, so "top up" is not translated as "top". */
    context?: string;
    language: TranslationLanguage;
};

export type TranslateResponse = {
    word: string;
    translation: string;
    /** Set when the word belongs to an expression that means something else. */
    phrase: { text: string; translation: string } | null;
};

/** One turn of speaking practice. Mirrors `TurnRequest` in the API. */
export type TutorTurnRequest = {
    language: TranslationLanguage;
    scene: string;
    words: string[];
    phrases: string[];
    names: string[];
    goals: { id: string; target: string; keywords: string[]; ask: string }[];
    goalIndex: number;
    attempt: number;
    /** Turns on the current goal that were questions rather than attempts. */
    asides: number;
    history: { role: "tutor" | "learner"; text: string }[];
    audio?: { mimeType: "audio/wav" | "audio/aac"; data: string };
};

export type TutorTurnResponse = {
    heard: string;
    reply: string;
    /** `aside`: the learner asked something instead of trying, which costs no try. */
    outcome: "opening" | "aside" | "retry" | "met" | "moveOn";
    finished: boolean;
    audio: { mimeType: "audio/wav"; data: string } | null;
};

export const api = {
    me: () => request<{ user: ApiUser }>("/v1/me"),
    /** Finished lessons, as the server has them. Shape is checked by the caller. */
    progress: () => request<{ progress: unknown }>("/v1/progress"),
    /** Sends the phone's copy; the server merges and answers with the result. */
    saveProgress: (progress: Progress) =>
        request<{ progress: unknown }>("/v1/progress", { method: "PUT", body: { progress } }),
    deleteAccount: () =>
        request<{ success: true; cleanupPending: boolean }>("/v1/me", { method: "DELETE" }),
    /** Sends the phone's choice; the server keeps whichever is newer and answers. */
    saveFirstLanguage: (choice: { language: FirstLanguage; updatedAt: string }) =>
        request<FirstLanguageResponse>("/v1/me/first-language", { method: "PUT", body: choice }),
    // A learner is holding a finger on a word while this runs, so it gets a
    // shorter deadline than an ordinary call. Twelve seconds rather than ten:
    // the server allows the model eight and spends about one more either side,
    // and giving up a moment before a good answer lands helps nobody.
    translate: (
        input: TranslateRequest,
        { signal, timeoutMs = 12_000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
    ) =>
        request<TranslateResponse>("/v1/translate", {
            method: "POST",
            body: input,
            timeoutMs,
            signal,
        }),
    // Transcribing, replying, checking the reply and speaking it happen in one
    // request, so a turn gets far longer than an ordinary call.
    tutorTurn: (turn: TutorTurnRequest) =>
        request<TutorTurnResponse>("/v1/tutor/turn", {
            method: "POST",
            body: turn,
            timeoutMs: 120_000,
        }),
};
