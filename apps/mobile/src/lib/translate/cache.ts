/**
 * Answers this phone has already been given, kept for the next time.
 *
 * A learner on a construction site has a connection at breakfast and none at
 * ten in the morning. A word they held yesterday should still open in their
 * language today, so every answer from the server is written down here, read
 * back into memory on first use, and answered from memory afterwards.
 *
 * One file per first language: a learner who changes their language is not
 * served the old one's words, and neither list has to be rewritten.
 *
 * Nothing here ever throws into a caller. A cache that cannot be written is a
 * cache miss, which costs one request, and a learner would rather have that
 * than a bubble with an error in it.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { FirstLanguage } from "@/lib/firstLanguage/languages";

import type { WordTranslation } from "./lookup";

/** What is worth keeping about one answer. The word and language are the key. */
export type CachedTranslation = {
    translation: string;
    phrase: { text: string; translation: string } | null;
};

/**
 * Roughly a fortnight of curious reading. Small enough that the whole file is
 * read in one go without the first hold of the day feeling slow.
 */
export const TRANSLATION_CACHE_LIMIT = 400;

const keyFor = (language: FirstLanguage) => `link.translate.v1.${language}`;

const memory = new Map<FirstLanguage, Map<string, CachedTranslation>>();
const loads = new Map<FirstLanguage, Promise<void>>();
/** One write at a time, in order, so an older list can never land last. */
let writes: Promise<void> = Promise.resolve();

function entriesFor(language: FirstLanguage): Map<string, CachedTranslation> {
    let entries = memory.get(language);
    if (!entries) {
        entries = new Map();
        memory.set(language, entries);
    }
    return entries;
}

/**
 * A short, stable stand-in for the sentence the word was held in.
 *
 * The context decides the answer ("top" in "top up your card" is not "top" on
 * its own), so it has to be part of the key, but keeping whole sentences on
 * disk would be both large and more of the learner's reading than we need. A
 * 32-bit FNV-1a hash is a few characters and collides far too rarely to matter
 * for a translation bubble.
 */
function hash(text: string): string {
    let value = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        value ^= text.charCodeAt(index);
        value = Math.imul(value, 0x01000193);
    }
    return (value >>> 0).toString(36);
}

/** The same sentence written with different spacing is the same sentence. */
function normalise(context: string): string {
    return context.toLowerCase().replace(/\s+/g, " ").trim();
}

export function translationCacheKey(word: string, context: string): string {
    return `${word.trim().toLowerCase()}|${hash(normalise(context))}`;
}

function readStored(value: unknown): [string, CachedTranslation][] {
    if (typeof value !== "object" || value === null) return [];
    const { entries } = value as { entries?: unknown };
    if (!Array.isArray(entries)) return [];
    const kept: [string, CachedTranslation][] = [];
    for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [key, answer] = entry as [unknown, unknown];
        if (typeof key !== "string" || typeof answer !== "object" || answer === null) continue;
        const { translation, phrase } = answer as { translation?: unknown; phrase?: unknown };
        if (typeof translation !== "string" || translation === "") continue;
        let expression: CachedTranslation["phrase"] = null;
        if (typeof phrase === "object" && phrase !== null) {
            const { text, translation: meaning } = phrase as {
                text?: unknown;
                translation?: unknown;
            };
            if (typeof text !== "string" || typeof meaning !== "string") continue;
            expression = { text, translation: meaning };
        }
        kept.push([key, { translation, phrase: expression }]);
    }
    return kept;
}

function load(language: FirstLanguage): Promise<void> {
    let loading = loads.get(language);
    if (loading) return loading;
    loading = (async () => {
        let stored: [string, CachedTranslation][] = [];
        try {
            const raw = await AsyncStorage.getItem(keyFor(language));
            if (raw) stored = readStored(JSON.parse(raw));
        } catch {
            // An unreadable file is an empty cache, not a failed translation.
        }
        // Anything written while the file was being read is newer than the file
        // itself, so it is added last and survives the cap.
        const fresh = entriesFor(language);
        const merged = new Map(stored);
        for (const [key, answer] of fresh) merged.set(key, answer);
        memory.set(language, capped(merged));
    })();
    loads.set(language, loading);
    return loading;
}

function capped(entries: Map<string, CachedTranslation>): Map<string, CachedTranslation> {
    // A Map hands its keys back in the order they were added, so the oldest
    // answers are simply the first ones.
    while (entries.size > TRANSLATION_CACHE_LIMIT) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
    }
    return entries;
}

function persist(language: FirstLanguage) {
    const snapshot = JSON.stringify({
        version: 1,
        entries: [...entriesFor(language)],
    });
    writes = writes
        .then(() => AsyncStorage.setItem(keyFor(language), snapshot))
        .catch(() => undefined);
}

/** Resolves once everything queued so far is on disk. For tests. */
export function flushTranslationCache(): Promise<void> {
    return writes;
}

/** An answer already given for this word in this sentence, or null. */
export async function readTranslationCache(
    word: string,
    context: string,
    language: FirstLanguage,
): Promise<WordTranslation | null> {
    await load(language);
    const found = entriesFor(language).get(translationCacheKey(word, context));
    if (!found) return null;
    return { word, translation: found.translation, phrase: found.phrase, source: "cache" };
}

/**
 * Remember an answer. Returns nothing and never rejects: the learner already
 * has their translation, and whether it was written down is our problem.
 */
export function writeTranslationCache(
    word: string,
    context: string,
    language: FirstLanguage,
    answer: CachedTranslation,
): void {
    const entries = entriesFor(language);
    const key = translationCacheKey(word, context);
    // Deleted first so a word looked up again counts as the newest, rather than
    // keeping the place it had when it was first seen.
    entries.delete(key);
    entries.set(key, answer);
    capped(entries);
    persist(language);
}

/** Test seam: an empty cache, and storage read afresh. */
export function resetTranslationCacheForTests() {
    memory.clear();
    loads.clear();
    writes = Promise.resolve();
}
