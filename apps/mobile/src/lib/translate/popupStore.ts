/**
 * The word under the learner's finger, and the bubble that is open for it.
 *
 * Both live here, outside React, for one reason each. The word is written by
 * whichever of several hundred pieces of text the finger lands on and read half
 * a second later by the one gesture at the root of the app, and those two have
 * no component in common to pass it through. The bubble is kept here so that
 * opening it re-renders the bubble and nothing else: if it lived in a context,
 * every piece of text on the screen would render again each time a learner
 * held a word.
 */

import { useSyncExternalStore } from "react";

export type WordTouch = {
    word: string;
    /** The sentence the word is in, which is what tells "top up" from "top". */
    context: string;
    /** Where the finger came down, in window coordinates. */
    x: number;
    y: number;
    /** About how tall a line of this text is, so the bubble can stand clear of it. */
    lineHeight: number;
    /** The native event's own timestamp, which names the touch this belongs to. */
    eventTime: number;
    /** This phone's clock when the finger came down. */
    at: number;
};

export type Popup = Pick<WordTouch, "word" | "context" | "x" | "y" | "lineHeight"> & {
    /** Changes every time a bubble opens, even for the same word again. */
    id: number;
};

/**
 * A hold is reported about half a second after the finger came down. Anything
 * much older was left behind by an earlier touch and must not be answered.
 */
const MAX_AGE_MS = 1500;
/** The gesture gives up when the finger moves 10 points, so this is generous. */
const MAX_DRIFT = 24;

let touch: WordTouch | null = null;
let popup: Popup | null = null;
let lastId = 0;
const listeners = new Set<() => void>();

function announce() {
    listeners.forEach((listener) => listener());
}

/** Called by a word when a finger comes down on it. */
export function recordWordTouch(next: WordTouch) {
    touch = next;
}

/** Whether the touch that produced this native event came down on a word. */
export function isWordTouch(eventTime: number): boolean {
    return touch !== null && touch.eventTime === eventTime;
}

/** A finger came down somewhere that is not a word, so there is nothing to hold. */
export function clearWordTouch() {
    touch = null;
}

/**
 * The finger has stayed where it came down. Opens the bubble if that was on a
 * word, and says whether it did.
 *
 * Plain function rather than something buried in the gesture, so a test can
 * hold a word without a native gesture system to do it with.
 */
export function holdAt(x: number, y: number, now: number = Date.now()): boolean {
    const held = touch;
    touch = null;
    if (!held) return false;
    const age = now - held.at;
    if (age < 0 || age > MAX_AGE_MS) return false;
    if (Math.abs(held.x - x) > MAX_DRIFT || Math.abs(held.y - y) > MAX_DRIFT) return false;

    // A second word held while a bubble is open replaces it: same store slot,
    // new id, so the bubble moves rather than stacking.
    popup = {
        id: ++lastId,
        word: held.word,
        context: held.context,
        x: held.x,
        y: held.y,
        lineHeight: held.lineHeight,
    };
    announce();
    return true;
}

export function closePopup() {
    if (!popup) return;
    popup = null;
    announce();
}

export function getPopup(): Popup | null {
    return popup;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function usePopup(): Popup | null {
    return useSyncExternalStore(subscribe, getPopup, getPopup);
}

/** Test seam: no finger down, no bubble open. */
export function resetPopupForTests() {
    touch = null;
    popup = null;
    announce();
}
