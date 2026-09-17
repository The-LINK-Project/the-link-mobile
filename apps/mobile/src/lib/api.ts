import { isClerkAPIResponseError, useAuth } from "@clerk/expo";
import { useLayoutEffect, useState } from "react";

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
};

async function request<T>(
    path: string,
    { method = "GET", body, timeoutMs = 20_000 }: RequestOptions = {},
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
        throw new ApiError(0, aborted ? "The request timed out" : "Network error");
    } finally {
        clearTimeout(timer);
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
};

/** One turn of speaking practice. Mirrors `TurnRequest` in the API. */
export type TutorTurnRequest = {
    language: "bn" | "ta" | "hi";
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
    // Transcribing, replying, checking the reply and speaking it happen in one
    // request, so a turn gets far longer than an ordinary call.
    tutorTurn: (turn: TutorTurnRequest) =>
        request<TutorTurnResponse>("/v1/tutor/turn", {
            method: "POST",
            body: turn,
            timeoutMs: 120_000,
        }),
};
