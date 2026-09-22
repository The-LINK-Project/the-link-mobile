/**
 * Copies the learner's chosen language to the server and back.
 *
 * The phone is where the choice is made and where it is used, and the bubble
 * works with no connection at all. The server copy exists so a learner who
 * loses their phone, or signs in on another, is not asked the question a second
 * time. So this runs in the background, never blocks a screen, and says nothing
 * when it fails. The next change, or the next launch, tries again.
 */

import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState, useSyncExternalStore } from "react";

import { api } from "@/lib/api";

import {
    getFirstLanguageChoice,
    mergeRemoteFirstLanguage,
    readFirstLanguageChoice,
    setFirstLanguageListener,
    useFirstLanguage,
    useFirstLanguageLoaded,
} from "./store";

/**
 * How long the onboarding screen waits for the server before asking.
 *
 * A learner who already chose on another phone should not be asked again, so it
 * is worth waiting for `GET /v1/me`. But a learner on a slow bus is worth more,
 * and being asked once too often is a far smaller harm than a spinner that
 * never ends.
 */
export const FIRST_LANGUAGE_WAIT_MS = 4000;

let inFlight: Promise<void> | null = null;
let again = false;

// Whether the first server check since this account signed in has finished, one
// way or the other. Its own tiny store, because the status hook has to render
// again the moment it lands.
let checked = false;
const checkedListeners = new Set<() => void>();

function isChecked() {
    return checked;
}

function setChecked(value: boolean) {
    if (checked === value) return;
    checked = value;
    checkedListeners.forEach((listener) => listener());
}

function subscribeChecked(listener: () => void) {
    checkedListeners.add(listener);
    return () => checkedListeners.delete(listener);
}

async function syncOnce(): Promise<void> {
    const { user } = await api.me();
    const remote = readFirstLanguageChoice({
        language: user.firstLanguage,
        updatedAt: user.firstLanguageUpdatedAt,
    });
    const phoneIsNewer = mergeRemoteFirstLanguage(remote);
    const mine = getFirstLanguageChoice();
    if (!phoneIsNewer || !mine) return;
    const saved = await api.saveFirstLanguage(mine);
    mergeRemoteFirstLanguage(
        readFirstLanguageChoice({
            language: saved.firstLanguage,
            updatedAt: saved.firstLanguageUpdatedAt,
        }),
    );
}

/** Safe to call at any time: calls made during a sync are folded into one more. */
export function syncFirstLanguage(): Promise<void> {
    if (inFlight) {
        again = true;
        return inFlight;
    }
    inFlight = syncOnce()
        .catch(() => undefined)
        .finally(() => {
            inFlight = null;
            // A failed check still counts as checked. The screen has waited as
            // long as it usefully can, and asking the learner is the answer.
            setChecked(true);
            if (again) {
                again = false;
                void syncFirstLanguage();
            }
        });
    return inFlight;
}

/** Syncs at sign-in and after every change the learner makes. */
export function useFirstLanguageSync(userId: string | null | undefined) {
    useEffect(() => {
        if (!userId) return;
        // A different account has not been checked, whatever the last one knew.
        setChecked(false);
        setFirstLanguageListener(() => void syncFirstLanguage());
        void syncFirstLanguage();
        return () => setFirstLanguageListener(null);
    }, [userId]);
}

/**
 * What the app should do about this learner's first language right now.
 *
 * "loading": storage not read yet, or nothing saved and the first server check
 *            has not finished (gives up after 4 seconds, or at once when
 *            offline).
 * "missing": ask the learner.
 * "set":     a choice exists.
 *
 * Once a choice exists this is "set" and never goes back to loading, so the
 * account screen cannot blink into a spinner because a sync started.
 */
export function useFirstLanguageStatus(): "loading" | "missing" | "set" {
    const loaded = useFirstLanguageLoaded();
    const [language] = useFirstLanguage();
    const serverChecked = useSyncExternalStore(subscribeChecked, isChecked, isChecked);
    const [gaveUp, setGaveUp] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setGaveUp(true), FIRST_LANGUAGE_WAIT_MS);
        const unsubscribe = NetInfo.addEventListener((state) => {
            // Only a flat "no connection" is trusted here. On some networks the
            // reachability probe is blocked and reports the phone unreachable
            // while every request still works, and waiting on that would ask
            // half our learners to choose a language they already chose.
            if (state.isConnected === false) setGaveUp(true);
        });
        return () => {
            clearTimeout(timer);
            unsubscribe();
        };
    }, []);

    if (language) return "set";
    if (!loaded) return "loading";
    return serverChecked || gaveUp ? "missing" : "loading";
}

/** Test seam: forget that the server was ever asked. */
export function resetFirstLanguageSyncForTests() {
    inFlight = null;
    again = false;
    checked = false;
    checkedListeners.clear();
}
