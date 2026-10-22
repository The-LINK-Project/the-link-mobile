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
import {
    acceptSavedProgress,
    getProgressData,
    mergeRemoteProgress,
    progressOwner,
    setProgressListener,
} from "./store";

let inFlight: Promise<void> | null = null;
let again = false;

async function syncOnce(): Promise<void> {
    // A shared phone can change hands mid-sync: one learner signs out and the
    // next signs in while the server is still answering. What it sent belongs
    // to whoever was signed in when it was asked, and must not be folded into
    // the next person's progress, nor saved to their account.
    const owner = progressOwner();
    const remote = readProgress((await api.progress()).progress);
    if (progressOwner() !== owner) return;
    const phoneKnowsMore = mergeRemoteProgress(remote);
    if (!phoneKnowsMore) return;
    const sent = getProgressData().progress;
    const saved = await api.saveProgress(sent);
    if (progressOwner() !== owner) return;
    acceptSavedProgress(sent, readProgress(saved.progress));
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
