/**
 * Where the translation bubble goes, given where the finger came down.
 *
 * Kept apart from the component so the rules can be read, and tested, without
 * drawing anything: above the word unless there is no room, never under the
 * status bar or off the side of the screen, and the pointer always on the word
 * even when the bubble itself has been pushed sideways.
 *
 * The bubble is as wide as what is in it, so its width is only known once it
 * has been laid out. Which side of the word it goes is decided straight away;
 * where it sits from left to right waits for that width.
 */

import { radius, spacing } from "@/lib/theme";

/** The pointer is a square turned on its corner; this is the square's side. */
export const POINTER_SIZE = 10;
/** How far that corner reaches out of the bubble: half the square's diagonal. */
export const POINTER_REACH = Math.round((POINTER_SIZE * Math.SQRT2) / 2);

/** Wide enough for a short word and the speaker beside it. */
export const MIN_WIDTH = 96;
/** A bubble is a note beside the word, not a sheet over the screen. */
const MAX_WIDTH_SHARE = 0.66;

/** Clear space kept between the bubble and the edges of the screen. */
const MARGIN = spacing.md;
/** Clear space between the pointer's tip and the line of text. */
const GAP = 2;
/**
 * The height of a bubble whose translation runs to a second line and has a
 * phrase under it. Room is judged against this from the start, because those
 * arrive after the bubble is already up and a bubble that then changed sides
 * would be a jump.
 */
const ROOM_WANTED = 140;
/** The pointer stays off the rounded corners, where it would look broken. */
const POINTER_INSET = radius.md;

type Insets = { top: number; bottom: number; left: number; right: number };

export type Placement = {
    side: "above" | "below";
    /**
     * Above: the distance from the bottom of the frame to the bottom of the
     * bubble. Below: from the top of the frame to the top of the bubble. The
     * bubble is pinned by the edge nearest the word, so when a late phrase line
     * makes it taller it grows away from the word and the pointer stays put.
     */
    offset: number;
    maxWidth: number;
    left: number;
    /** Left edge of the pointer, measured inside the bubble. */
    pointerLeft: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** `width` is the bubble's own, as laid out, or null before that is known. */
export function placeBubble(
    anchor: { x: number; y: number; lineHeight: number },
    frame: { width: number; height: number },
    insets: Insets,
    width: number | null,
): Placement {
    const minLeft = insets.left + MARGIN;
    const maxRight = frame.width - insets.right - MARGIN;
    const maxWidth = Math.max(
        MIN_WIDTH,
        Math.min(maxRight - minLeft, frame.width * MAX_WIDTH_SHARE),
    );

    // Centred on the finger, then pushed back inside the screen. The pointer
    // does not move with it: it stays on the word.
    const laidOut = width ?? MIN_WIDTH;
    const left = clamp(anchor.x - laidOut / 2, minLeft, Math.max(minLeft, maxRight - laidOut));
    const pointerLeft = clamp(
        anchor.x - left - POINTER_SIZE / 2,
        POINTER_INSET,
        Math.max(POINTER_INSET, laidOut - POINTER_INSET - POINTER_SIZE),
    );

    // The finger is somewhere on the word's line, not necessarily in the middle
    // of it, so the bubble stands off by half a line either way. At worst the
    // pointer's tip touches the top of the letters; the bubble never covers them.
    const clearance = anchor.lineHeight / 2 + GAP + POINTER_REACH;
    const bottomIfAbove = anchor.y - clearance;
    const topIfBelow = anchor.y + clearance;
    const roomAbove = bottomIfAbove - (insets.top + MARGIN);
    const roomBelow = frame.height - insets.bottom - MARGIN - topIfBelow;

    // Above is where a hand does not cover it, so below has to earn its place.
    const above = roomAbove >= ROOM_WANTED || roomAbove >= roomBelow;
    return {
        side: above ? "above" : "below",
        offset: above ? frame.height - bottomIfAbove : topIfBelow,
        maxWidth,
        left,
        pointerLeft,
    };
}
