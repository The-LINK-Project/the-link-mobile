/**
 * Copies finished lessons to the server and back.
 *
 * The phone is where learning is recorded, and it works with no connection at
 * all. The server copy exists for one reason: a learner who loses their phone,
 * or signs in on another, should not find every lesson marked new. So this runs
 * in the background, never blocks a screen, and says nothing when it fails.
 * The next finished lesson, or the next launch, tries again.
 */

import { useEffect } from "react";

import { api } from "@/lib/api";

import { readProgress } from "./model";
import { getProgressData, mergeRemoteProgress, setProgressListener } from "./store";

let inFlight: Promise<void> | null = null;
let again = false;

async function syncOnce(): Promise<void> {
    const remote = readProgress((await api.progress()).progress);
    const phoneKnowsMore = mergeRemoteProgress(remote);
    if (!phoneKnowsMore) return;
    const saved = await api.saveProgress(getProgressData().progress);
    mergeRemoteProgress(readProgress(saved.progress));
}

/** Safe to call at any time: calls made during a sync are folded into one more. */
export function syncProgress(): Promise<void> {
    if (inFlight) {
        again = true;
        return inFlight;
    }
    inFlight = syncOnce()
        .catch(() => undefined)
        .finally(() => {
            inFlight = null;
            if (again) {
                again = false;
                void syncProgress();
            }
        });
    return inFlight;
}

/** Syncs at sign-in and after every finished lesson or talk. */
export function useProgressSync(userId: string | null | undefined) {
    useEffect(() => {
        if (!userId) return;
        setProgressListener(() => void syncProgress());
        void syncProgress();
        return () => setProgressListener(null);
    }, [userId]);
}
