/**
 * Where the bubble goes: beside the word, inside the screen, pointing at it.
 */

import { radius } from "@/lib/theme";

import { MIN_WIDTH, placeBubble, POINTER_SIZE } from "../placement";

const frame = { width: 390, height: 844 };
const insets = { top: 24, bottom: 16, left: 0, right: 0 };
const line = 24;

it("goes above the word when there is room, pinned by its bottom edge", () => {
    const placed = placeBubble({ x: 195, y: 500, lineHeight: line }, frame, insets, 120);
    expect(placed.side).toBe("above");
    // Pinned from the bottom of the frame, clear of the word's line.
    expect(frame.height - placed.offset).toBeLessThan(500 - line / 2);
    expect(placed.left).toBe(195 - 60);
});

it("goes below a word near the top of the screen, as under a heading", () => {
    const placed = placeBubble({ x: 80, y: 136, lineHeight: 40 }, frame, insets, 120);
    expect(placed.side).toBe("below");
    expect(placed.offset).toBeGreaterThan(136 + 20);
});

it("stays inside the left and right edges, and keeps the pointer on the word", () => {
    const left = placeBubble({ x: 20, y: 500, lineHeight: line }, frame, insets, 160);
    expect(left.left).toBe(12);
    // As near the finger as it can get without sitting on the rounded corner,
    // which is a long way from the middle of the bubble.
    expect(left.pointerLeft).toBe(radius.md);

    // A little further in and it is exactly under the finger again.
    const inward = placeBubble({ x: 60, y: 500, lineHeight: line }, frame, insets, 160);
    expect(inward.left + inward.pointerLeft + POINTER_SIZE / 2).toBe(60);

    const right = placeBubble({ x: 380, y: 500, lineHeight: line }, frame, insets, 160);
    expect(right.left + 160).toBe(frame.width - 12);
    expect(right.pointerLeft).toBeLessThanOrEqual(160 - POINTER_SIZE);
});

it("points exactly at the finger when the bubble has not had to move", () => {
    const placed = placeBubble({ x: 200, y: 500, lineHeight: line }, frame, insets, 140);
    expect(placed.left + placed.pointerLeft + POINTER_SIZE / 2).toBe(200);
});

it("is never wider than about two thirds of the screen", () => {
    const placed = placeBubble({ x: 195, y: 500, lineHeight: line }, frame, insets, null);
    expect(placed.maxWidth).toBeLessThanOrEqual(frame.width * 0.7);
    expect(placed.maxWidth).toBeGreaterThanOrEqual(MIN_WIDTH);
});

it("has somewhere sensible to be before its width is known", () => {
    const placed = placeBubble({ x: 5, y: 500, lineHeight: line }, frame, insets, null);
    expect(placed.left).toBeGreaterThanOrEqual(12);
    expect(Number.isFinite(placed.pointerLeft)).toBe(true);
});
