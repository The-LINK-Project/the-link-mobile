/**
 * One voice at a time, across the whole app: the tutor, the learner's own
 * recording played back, and a lesson word or sentence (lib/lessons/speech.ts),
 * wherever it was started from. Whatever starts talking quiets whatever was
 * talking before, so a word read from the hold-to-translate bubble never plays
 * over the tutor, and the microphone can quiet everyone before it opens.
 *
 * A speaker is known by its `stop`, which must be safe to call at any time.
 */

let speaker: (() => void) | null = null;

/** `stop`'s owner is about to make sound: whoever spoke last is quieted first. */
export function takeTheFloor(stop: () => void) {
    if (speaker && speaker !== stop) speaker();
    speaker = stop;
}

/** A speaker going away, with its screen, is not one to quiet any more. */
export function leaveTheFloor(stop: () => void) {
    if (speaker === stop) speaker = null;
}

/** Quiet whoever is talking: before the microphone opens, say. */
export function quietEveryone() {
    const current = speaker;
    speaker = null;
    current?.();
}
