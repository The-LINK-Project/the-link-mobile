/**
 * The learner's progress, kept on the phone.
 *
 * Held in memory and written through to AsyncStorage on every change, so a
 * screen reads it synchronously and nothing is lost when the phone closes the
 * app without warning, which on a cheap Android with little memory is how most
 * sessions end. One blob per account: a shared phone is common in a dormitory,
 * and the next person to sign in must not inherit somebody else's ticks.
 *
 * Writes are best-effort. A full disk must not stop a lesson.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
    asServerKeeps,
    emptyData,
    foldStored,
    keptDates,
    mergeProgress,
    readData,
    sameProgress,
    withLessonDone,
    withSpeakingDone,
    type KeptDates,
    type Progress,
    type ProgressData,
    type SavedRun,
    type SavedTalk,
} from "./model";

const keyFor = (userId: string) => `link.progress.v1.${userId}`;

let owner: string | null = null;
let data: ProgressData = emptyData();
const listeners = new Set<() => void>();
/** Called after finished work changes, so it can be copied to the server. */
let onProgressChanged: (() => void) | null = null;
/** One write at a time, in order, so an older snapshot can never land last. */
let writes: Promise<void> = Promise.resolve();
/** Each account's newest change not yet on disk. A queued write takes the newest. */
const pending = new Map<string, ProgressData>();
/**
 * Accounts whose stored progress could not be read: storage failed, as opposed
 * to holding nothing. Their memory works as usual, but nothing is written until
 * the stored copy has been read and folded in, or what was finished on this
 * phone would be written over with a blank slate.
 */
const unreadable = new Set<string>();
/** Dates the server moved back from this phone's fast clock (see keptDates). */
let kept: KeptDates = {};

const notify = () => listeners.forEach((listener) => listener());

function commit(next: ProgressData) {
    data = next;
    notify();
    if (!owner) return;
    const user = owner;
    pending.set(user, next);
    writes = writes.then(() => persist(user)).catch(() => undefined);
}

async function persist(user: string) {
    if (!pending.has(user)) return;
    if (unreadable.has(user)) {
        const stored = await readStored(user);
        // Still unreadable: the change waits, and nothing is written over it.
        if (stored === UNREADABLE) return;
        unreadable.delete(user);
        const waiting = pending.get(user);
        if (stored && waiting) pending.set(user, foldStored(stored, waiting));
        if (stored && owner === user) {
            data = foldStored(stored, data);
            notify();
        }
    }
    const snapshot = pending.get(user);
    pending.delete(user);
    if (snapshot) await AsyncStorage.setItem(keyFor(user), JSON.stringify(snapshot));
}

const UNREADABLE = Symbol("unreadable");

/**
 * What is stored for an account: its progress, null when nothing usable is
 * there, or UNREADABLE when storage itself failed twice. A file that will not
 * parse starts the learner afresh; a failed read must not, because writing
 * after it would replace the real file with nothing.
 */
async function readStored(userId: string): Promise<ProgressData | null | typeof UNREADABLE> {
    for (let attempt = 0; attempt < 2; attempt++) {
        let stored: string | null;
        try {
            stored = await AsyncStorage.getItem(keyFor(userId));
        } catch {
            // "Database is locked" on a busy Android usually clears in a moment.
            if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
        }
        if (!stored) return null;
        try {
            return readData(JSON.parse(stored));
        } catch {
            return null;
        }
    }
    return UNREADABLE;
}

/** Resolves once everything queued so far is on disk. For tests and sign-out. */
export function flushProgress(): Promise<void> {
    return writes;
}

export async function loadProgress(userId: string): Promise<void> {
    if (owner === userId) return;
    owner = userId;
    data = emptyData();
    kept = {};
    unreadable.delete(userId);
    const stored = await readStored(userId);
    // Somebody else signed in while this was being read.
    if (owner !== userId) return;
    if (stored === UNREADABLE) unreadable.add(userId);
    else if (stored) data = stored;
    notify();
}

/** Forget whose progress is in memory. The file stays for their next sign-in. */
export function unloadProgress() {
    owner = null;
    data = emptyData();
    kept = {};
    notify();
}

/** Remove an account's progress from this phone, for account deletion. */
export async function eraseProgress(userId: string): Promise<void> {
    if (owner === userId) unloadProgress();
    pending.delete(userId);
    unreadable.delete(userId);
    await writes;
    await AsyncStorage.removeItem(keyFor(userId)).catch(() => undefined);
}

/** Whose progress is in memory, so a sync can tell the phone changed hands under it. */
export function progressOwner(): string | null {
    return owner;
}

export function getProgressData(): ProgressData {
    return data;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useProgressData(): ProgressData {
    return useSyncExternalStore(subscribe, getProgressData, getProgressData);
}

/**
 * True once this account's progress has been read, or at once when nobody is
 * signed in and there is nothing to read. Gate the first screen on it.
 */
export function useProgressReady(userId: string | null | undefined): boolean {
    const [readyFor, setReadyFor] = useState<string | null>(null);
    useEffect(() => {
        if (!userId) {
            unloadProgress();
            return;
        }
        let cancelled = false;
        void loadProgress(userId).finally(() => {
            if (!cancelled) setReadyFor(userId);
        });
        return () => {
            cancelled = true;
        };
    }, [userId]);
    return !userId || readyFor === userId;
}

export function setProgressListener(listener: (() => void) | null) {
    onProgressChanged = listener;
}

// --------------------------------------------------------------- a lesson run

/** `href` is the screen showing this run, remembered as the place to reopen on. */
export function saveRun(lessonId: string, run: Omit<SavedRun, "savedAt">, href?: string) {
    const at = new Date().toISOString();
    commit({
        ...data,
        runs: { ...data.runs, [lessonId]: { ...run, savedAt: at } },
        resume: href ? { href, at } : data.resume,
    });
}

/** Forget a run the learner chose to start again, so leaving does not bring it back. */
export function clearRun(lessonId: string) {
    if (!(lessonId in data.runs)) return;
    const { [lessonId]: _gone, ...runs } = data.runs;
    commit({ ...data, runs });
}

export function completeLesson(
    lessonId: string,
    result: { firstTryCorrect: number; total: number },
) {
    const { [lessonId]: _gone, ...runs } = data.runs;
    commit({
        ...data,
        runs,
        resume: null,
        progress: withLessonDone(data.progress, lessonId, result),
    });
    onProgressChanged?.();
}

// ------------------------------------------------------- a talk with the tutor

export function saveTalk(lessonId: string, talk: Omit<SavedTalk, "savedAt">, href?: string) {
    const at = new Date().toISOString();
    commit({
        ...data,
        talks: { ...data.talks, [lessonId]: { ...talk, savedAt: at } },
        resume: href ? { href, at } : data.resume,
    });
}

export function clearTalk(lessonId: string) {
    if (!(lessonId in data.talks)) return;
    const { [lessonId]: _gone, ...talks } = data.talks;
    commit({ ...data, talks });
}

export function completeSpeaking(lessonId: string, result: { said: number; total: number }) {
    const { [lessonId]: _gone, ...talks } = data.talks;
    commit({
        ...data,
        talks,
        resume: null,
        progress: withSpeakingDone(data.progress, lessonId, result),
    });
    onProgressChanged?.();
}

// ------------------------------------------------------------ reopening the app

/** Remember the screen to reopen on, or null once the learner leaves it. */
export function setResume(href: string | null) {
    if (href === null && data.resume === null) return;
    commit({ ...data, resume: href ? { href, at: new Date().toISOString() } : null });
}

/**
 * The screen to reopen on, handed out once. A second Home mount in the same
 * launch (coming back from a lesson) must not bounce the learner in again.
 */
let resumeOffered = false;
export function takeResume(): string | null {
    if (resumeOffered) return null;
    resumeOffered = true;
    const resume = data.resume;
    if (!resume) return null;
    return resume.href;
}

// ------------------------------------------------------------------ the server

/** Fold the server's copy in. Returns true when the phone knew something it did not. */
export function mergeRemoteProgress(remote: Progress): boolean {
    const merged = mergeProgress(data.progress, remote);
    if (!sameProgress(merged, data.progress)) commit({ ...data, progress: merged });
    // A date the server moved back is one it has already. Counting it as news
    // would send the same lessons on every sync, to be moved back every time.
    return !sameProgress(asServerKeeps(merged, kept), remote);
}

/** Fold in the server's answer to a save of `sent`, noting any date it moved back. */
export function acceptSavedProgress(sent: Progress, saved: Progress) {
    kept = { ...kept, ...keptDates(sent, saved) };
    mergeRemoteProgress(saved);
}

/** Test seam: start from nothing. */
export function resetProgressForTests() {
    owner = null;
    data = emptyData();
    resumeOffered = false;
    onProgressChanged = null;
    writes = Promise.resolve();
    pending.clear();
    unreadable.clear();
    kept = {};
}
