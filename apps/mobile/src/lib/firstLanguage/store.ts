/**
 * The language a learner reads best, kept on the phone.
 *
 * Held in memory and written through to AsyncStorage, exactly like progress, so
 * the translation bubble can read it synchronously while a finger is still down
 * on the word. One key per account: phones are shared in a dormitory, and the
 * next person to sign in must never be shown the last learner's language.
 *
 * Writes are best-effort. A full disk must not stop a translation.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { isFirstLanguage, type FirstLanguage } from "./languages";

export type FirstLanguageChoice = { language: FirstLanguage; updatedAt: string };

const keyFor = (userId: string) => `link.firstLanguage.v1.${userId}`;

/**
 * `loaded` is separate from `choice === null`: "we have not looked yet" and
 * "this learner has not chosen" lead to different screens, and confusing them
 * flashes the onboarding question at a learner who answered it months ago.
 */
type State = { loaded: boolean; choice: FirstLanguageChoice | null };

let owner: string | null = null;
let state: State = { loaded: false, choice: null };
const listeners = new Set<() => void>();
/** Called after a local change, so it can be copied to the server. */
let onChoiceChanged: (() => void) | null = null;
/** One write at a time, in order, so an older choice can never land last. */
let writes: Promise<void> = Promise.resolve();

function announce() {
    listeners.forEach((listener) => listener());
}

function commit(next: State) {
    state = next;
    announce();
    const key = owner ? keyFor(owner) : null;
    if (!key) return;
    const snapshot = JSON.stringify(next.choice);
    writes = writes.then(() => AsyncStorage.setItem(key, snapshot)).catch(() => undefined);
}

/** Resolves once everything queued so far is on disk. For tests and sign-out. */
export function flushFirstLanguage(): Promise<void> {
    return writes;
}

/**
 * A choice read back from storage or from the server.
 *
 * Anything unrecognisable is dropped rather than trusted. A choice with no
 * usable timestamp is kept but dated to the epoch, so the server's copy wins
 * the merge: a language we cannot date is a language we cannot defend.
 */
export function readFirstLanguageChoice(value: unknown): FirstLanguageChoice | null {
    if (isFirstLanguage(value)) return { language: value, updatedAt: EPOCH };
    if (typeof value !== "object" || value === null) return null;
    const { language, updatedAt } = value as { language?: unknown; updatedAt?: unknown };
    if (!isFirstLanguage(language)) return null;
    const dated =
        typeof updatedAt === "string" && !Number.isNaN(Date.parse(updatedAt))
            ? new Date(updatedAt).toISOString()
            : EPOCH;
    return { language, updatedAt: dated };
}

const EPOCH = new Date(0).toISOString();

/** The later of two choices. A tie goes to `b`, which callers pass as the server's. */
function newer(a: FirstLanguageChoice | null, b: FirstLanguageChoice | null) {
    if (!a || !b) return a ?? b;
    return Date.parse(a.updatedAt) > Date.parse(b.updatedAt) ? a : b;
}

function same(a: FirstLanguageChoice | null, b: FirstLanguageChoice | null) {
    if (!a || !b) return a === b;
    return a.language === b.language && a.updatedAt === b.updatedAt;
}

export async function loadFirstLanguage(userId: string): Promise<void> {
    if (owner === userId && state.loaded) return;
    owner = userId;
    state = { loaded: false, choice: null };
    let stored: FirstLanguageChoice | null = null;
    try {
        const raw = await AsyncStorage.getItem(keyFor(userId));
        // Somebody else signed in while this was being read.
        if (owner !== userId) return;
        if (raw) stored = readFirstLanguageChoice(JSON.parse(raw));
    } catch {
        // Unreadable storage asks the learner again rather than crashing.
    }
    if (owner !== userId) return;
    // The first sync can answer before the disk does, so what is already in
    // memory is merged in rather than overwritten, by the same last-write-wins
    // rule as everywhere else.
    commit({ loaded: true, choice: newer(stored, state.choice) });
}

/** Forget whose language is in memory. The file stays for their next sign-in. */
export function unloadFirstLanguage() {
    owner = null;
    state = { loaded: false, choice: null };
    announce();
}

/** Remove an account's choice from this phone, for account deletion. */
export async function eraseFirstLanguage(userId: string): Promise<void> {
    if (owner === userId) unloadFirstLanguage();
    await writes;
    await AsyncStorage.removeItem(keyFor(userId)).catch(() => undefined);
}

export function getFirstLanguage(): FirstLanguage | null {
    return state.choice?.language ?? null;
}

export function getFirstLanguageChoice(): FirstLanguageChoice | null {
    return state.choice;
}

/** True once this account's saved choice has been read from storage. */
export function isFirstLanguageLoaded(): boolean {
    return state.loaded;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Record the learner's answer, stamped with this phone's clock.
 *
 * The clock is the only one available at the moment of the tap, and a phone set
 * to the wrong year is rarer than a learner with no connection. The server
 * clamps a timestamp from the future when it hears about it.
 */
export function setFirstLanguage(language: FirstLanguage): Promise<void> {
    commit({ loaded: true, choice: { language, updatedAt: new Date().toISOString() } });
    onChoiceChanged?.();
    return writes;
}

export function useFirstLanguage(): [
    FirstLanguage | null,
    (language: FirstLanguage) => Promise<void>,
] {
    const language = useSyncExternalStore(subscribe, getFirstLanguage, getFirstLanguage);
    const change = useCallback((next: FirstLanguage) => setFirstLanguage(next), []);
    return [language, change];
}

export function useFirstLanguageLoaded(): boolean {
    return useSyncExternalStore(subscribe, isFirstLanguageLoaded, isFirstLanguageLoaded);
}

/** True once the saved choice for this account has been read from storage. */
export function useFirstLanguageReady(userId: string | null | undefined): boolean {
    const [readyFor, setReadyFor] = useState<string | null>(null);
    useEffect(() => {
        if (!userId) {
            unloadFirstLanguage();
            return;
        }
        let cancelled = false;
        void loadFirstLanguage(userId).finally(() => {
            if (!cancelled) setReadyFor(userId);
        });
        return () => {
            cancelled = true;
        };
    }, [userId]);
    return !userId || readyFor === userId;
}

export function setFirstLanguageListener(listener: (() => void) | null) {
    onChoiceChanged = listener;
}

/**
 * Takes the server's copy if it is newer. Returns true when the phone's is.
 *
 * Last write wins, and a tie goes to the server: two writes in the same
 * millisecond are almost certainly the same write coming back, and preferring
 * the server there stops the phone pushing it again on every launch.
 */
export function mergeRemoteFirstLanguage(remote: FirstLanguageChoice | null): boolean {
    const mine = state.choice;
    if (!remote) return mine !== null;
    if (mine && Date.parse(mine.updatedAt) > Date.parse(remote.updatedAt)) return true;
    if (!same(mine, remote)) commit({ ...state, choice: remote });
    return false;
}

/** Test seam: start from nothing. */
export function resetFirstLanguageForTests() {
    owner = null;
    state = { loaded: false, choice: null };
    onChoiceChanged = null;
    writes = Promise.resolve();
}
