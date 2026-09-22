/**
 * One English word, in the language the learner knows best.
 *
 * Three places are asked, in this order, and the first answer wins:
 *
 * 1. The lesson glossary on the phone. Instant, works with no connection, and
 *    already written by the same people who wrote the lesson.
 * 2. The cache of answers this phone has already been given, so a word looked
 *    up on the bus this morning still works in the tunnel tonight.
 * 3. `POST /v1/translate`, which is the only step that needs a connection.
 *
 * A learner is holding a finger on a word the whole time this runs, so nothing
 * here waits longer than it has to, and identical lookups already in flight are
 * shared rather than asked twice.
 */

import { ApiError, api } from "@/lib/api";
import type { TranslationLanguage } from "@/lib/firstLanguage/languages";

import { readTranslationCache, translationCacheKey, writeTranslationCache } from "./cache";
import { lookupGlossary } from "./glossary";
import { MAX_CONTEXT, sentenceAround } from "./tokens";

export type WordTranslation = {
    word: string;
    translation: string;
    /** The expression the word belongs to, when it means something on its own. */
    phrase: { text: string; translation: string } | null;
    source: "glossary" | "cache" | "network";
};

/**
 * A translation that could not be given.
 *
 * `reason` exists so the bubble can say the true thing: "no internet" invites
 * trying again later, "we could not translate this word" does not.
 */
export class TranslationError extends Error {
    constructor(
        public reason: "offline" | "failed",
        message?: string,
    ) {
        super(message ?? (reason === "offline" ? "No connection" : "Could not translate"));
        this.name = "TranslationError";
    }
}

/**
 * The shape the platform uses for a cancelled operation.
 *
 * A caller who let go of the word, or moved to another one, gets this rather
 * than a TranslationError: nothing went wrong, and nothing should be shown.
 */
function abortError(): Error {
    const error = new Error("Aborted");
    error.name = "AbortError";
    return error;
}

function isAbortError(error: unknown): boolean {
    return (error as { name?: string })?.name === "AbortError";
}

type Pending = {
    promise: Promise<WordTranslation>;
    controller: AbortController;
    /** Lookups sharing this request. At zero the request is no longer wanted. */
    waiters: number;
};

const pending = new Map<string, Pending>();

/** What the server sent, only if it is something we can actually show. */
function readAnswer(value: unknown, word: string): WordTranslation | null {
    if (typeof value !== "object" || value === null) return null;
    const { translation, phrase } = value as { translation?: unknown; phrase?: unknown };
    if (typeof translation !== "string" || translation.trim() === "") return null;
    let expression: WordTranslation["phrase"] = null;
    if (typeof phrase === "object" && phrase !== null) {
        const { text, translation: meaning } = phrase as { text?: unknown; translation?: unknown };
        if (typeof text !== "string" || typeof meaning !== "string") return null;
        if (text.trim() !== "" && meaning.trim() !== "") {
            expression = { text, translation: meaning };
        }
    }
    // The word is the one the learner held, not the server's echo of it: that
    // is what the bubble is pointing at.
    return { word, translation, phrase: expression, source: "network" };
}

async function askServer(
    input: { word: string; context: string; language: TranslationLanguage },
    signal: AbortSignal,
): Promise<WordTranslation> {
    const { word, context, language } = input;
    try {
        const answer = await api.translate({ word, context, language }, { signal });
        const usable = readAnswer(answer, word);
        if (!usable) throw new TranslationError("failed", "Unusable translation");
        writeTranslationCache(word, context, language, {
            translation: usable.translation,
            phrase: usable.phrase,
        });
        return usable;
    } catch (error) {
        if (error instanceof TranslationError || isAbortError(error)) throw error;
        // Status 0 is the client's own "never reached the server", which for a
        // learner underground is the ordinary case rather than a failure.
        if (error instanceof ApiError) {
            throw new TranslationError(error.status === 0 ? "offline" : "failed", error.message);
        }
        throw new TranslationError("failed", "Could not translate");
    }
}

function share(
    key: string,
    input: { word: string; context: string; language: TranslationLanguage },
): Pending {
    const existing = pending.get(key);
    if (existing) {
        existing.waiters += 1;
        return existing;
    }
    const controller = new AbortController();
    const asked = askServer(input, controller.signal);
    const entry: Pending = { controller, waiters: 1, promise: asked };
    // Forgotten as soon as it settles, so the next hold on the same word asks
    // again rather than being handed a stale answer.
    entry.promise = asked.finally(() => {
        if (pending.get(key) === entry) pending.delete(key);
    });
    pending.set(key, entry);
    return entry;
}

function release(key: string, entry: Pending) {
    entry.waiters -= 1;
    if (entry.waiters > 0) return;
    if (pending.get(key) === entry) pending.delete(key);
    // Nobody is waiting for this word any more, so stop asking for it. After
    // the request has finished this does nothing, which is what we want.
    entry.controller.abort();
}

/** Resolves with the promise, or rejects the moment this caller gives up. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(abortError());
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(abortError());
        signal.addEventListener("abort", onAbort);
        promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    });
}

/**
 * A context the server will accept.
 *
 * The bubble already hands over one sentence, cut around the word that was
 * held. This is the same rule applied at the door, for any other caller: the
 * server answers 400 to a context over its limit, and the learner would see
 * that as "we could not translate this word" on every long paragraph. With no
 * position to go on, the first place the word appears is used.
 */
export function fitContext(word: string, context: string): string {
    if (context.length <= MAX_CONTEXT) return context;
    const at = context.toLowerCase().indexOf(word.trim().toLowerCase());
    return at < 0 ? "" : sentenceAround(context, at, at + word.trim().length);
}

export async function lookupTranslation(input: {
    word: string;
    context: string;
    language: TranslationLanguage;
    signal?: AbortSignal;
}): Promise<WordTranslation> {
    const { word, language, signal } = input;
    if (signal?.aborted) throw abortError();
    // Trimmed once, here, so the glossary, the cache and the server are all
    // asked about the same sentence.
    const context = fitContext(word, input.context);

    const fromLesson = lookupGlossary(word, context, language);
    if (fromLesson) return fromLesson;

    const cached = await readTranslationCache(word, context, language);
    if (signal?.aborted) throw abortError();
    if (cached) return cached;

    const key = `${language}:${translationCacheKey(word, context)}`;
    const entry = share(key, { word, context, language });
    try {
        return await untilAborted(entry.promise, signal);
    } finally {
        release(key, entry);
    }
}

/** Test seam: forget any request still in flight. */
export function resetTranslationLookupsForTests() {
    pending.clear();
}
