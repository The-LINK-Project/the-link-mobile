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
/** Each account's newest choice not yet on disk. A queued write takes the newest. */
const pending = new Map<string, FirstLanguageChoice | null>();
/**
 * Accounts whose stored choice could not be read: storage failed, as opposed to
 * holding nothing. Their memory works as usual, but nothing is written until the
 * stored copy has been read and folded in, or the choice made on this phone
 * would be written over with nothing.
 */
const unreadable = new Set<string>();

function announce() {
    listeners.forEach((listener) => listener());
}

function commit(next: State) {
    state = next;
    announce();
    if (!owner) return;
    const user = owner;
    pending.set(user, next.choice);
    writes = writes.then(() => persist(user)).catch(() => undefined);
}

async function persist(user: string) {
    if (!pending.has(user)) return;
    if (unreadable.has(user)) {
        const stored = await readStored(user);
        // Still unreadable: the change waits, and nothing is written over it.
        if (stored === UNREADABLE) return;
        unreadable.delete(user);
        pending.set(user, newer(stored, pending.get(user) ?? null));
        const merged = newer(stored, state.choice);
        if (owner === user && !same(merged, state.choice)) {
            state = { ...state, choice: merged };
            announce();
        }
    }
    const snapshot = pending.get(user) ?? null;
    pending.delete(user);
    await AsyncStorage.setItem(keyFor(user), JSON.stringify(snapshot));
}

const UNREADABLE = Symbol("unreadable");

/**
 * What is stored for an account: its choice, null when nothing usable is there,
 * or UNREADABLE when storage itself failed twice. A file that will not parse
 * asks the learner again; a failed read must not, because writing after it
 * would replace the real choice with nothing.
 */
async function readStored(userId: string): Promise<FirstLanguageChoice | null | typeof UNREADABLE> {
    for (let attempt = 0; attempt < 2; attempt++) {
        let raw: string | null;
        try {
            raw = await AsyncStorage.getItem(keyFor(userId));
        } catch {
            // "Database is locked" on a busy Android usually clears in a moment.
            if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
        }
        if (!raw) return null;
        try {
            return readFirstLanguageChoice(JSON.parse(raw));
        } catch {
            return null;
        }
    }
    return UNREADABLE;
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
    unreadable.delete(userId);
    const stored = await readStored(userId);
    // Somebody else signed in while this was being read.
    if (owner !== userId) return;
    // Storage that will not answer still lets the learner in: the server's copy
    // arrives with the first sync, and is kept in memory until the disk can be
    // read and the two folded together.
    if (stored === UNREADABLE) unreadable.add(userId);
    // The first sync can answer before the disk does, so what is already in
    // memory is merged in rather than overwritten, by the same last-write-wins
    // rule as everywhere else.
    commit({
        loaded: true,
        choice: newer(stored === UNREADABLE ? null : stored, state.choice),
    });
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
    pending.delete(userId);
    unreadable.delete(userId);
    await writes;
    await AsyncStorage.removeItem(keyFor(userId)).catch(() => undefined);
}

/** Whose choice is in memory, so a sync can tell the phone changed hands under it. */
export function firstLanguageOwner(): string | null {
    return owner;
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
 *
 * The same language on both sides is no news either way, so the phone takes the
 * server's date for it. A phone whose clock runs fast keeps a date the server
 * has already moved back to the moment it heard the choice; holding on to it
 * would push the same language again on every sync and, worse, beat a later
 * choice made on another phone.
 */
export function mergeRemoteFirstLanguage(remote: FirstLanguageChoice | null): boolean {
    const mine = state.choice;
    if (!remote) return mine !== null;
    const sameLanguage = mine?.language === remote.language;
    if (mine && !sameLanguage && Date.parse(mine.updatedAt) > Date.parse(remote.updatedAt)) {
        return true;
    }
    if (!same(mine, remote)) commit({ ...state, choice: remote });
    return false;
}

/**
 * The server's answer to a choice this phone sent, which is final for it.
 *
 * The server has already compared the two, with its own clock in place of a
 * phone's that ran fast, so its answer stands even where the dates the phone
 * holds say otherwise. Unless the learner has chosen again since sending: that
 * newer choice is still to go, and is merged as usual rather than undone.
 */
export function settleSentFirstLanguage(
    sent: FirstLanguageChoice,
    saved: FirstLanguageChoice | null,
): void {
    if (!saved) return;
    if (same(state.choice, sent)) {
        if (!same(state.choice, saved)) commit({ ...state, choice: saved });
        return;
    }
    mergeRemoteFirstLanguage(saved);
}

/** Test seam: start from nothing. */
export function resetFirstLanguageForTests() {
    owner = null;
    state = { loaded: false, choice: null };
    onChoiceChanged = null;
    writes = Promise.resolve();
    pending.clear();
    unreadable.clear();
}
