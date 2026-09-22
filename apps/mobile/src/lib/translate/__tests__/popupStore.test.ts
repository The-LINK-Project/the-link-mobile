/**
 * The word under the finger, and when a hold is allowed to answer for it.
 */

import {
    clearWordTouch,
    closePopup,
    getPopup,
    holdAt,
    isWordTouch,
    recordWordTouch,
    resetPopupForTests,
    type WordTouch,
} from "../popupStore";

const NOW = 1_000_000;

function touch(over: Partial<WordTouch> = {}): WordTouch {
    return {
        word: "platform",
        context: "Find the right platform.",
        x: 120,
        y: 300,
        lineHeight: 24,
        eventTime: 42,
        at: NOW,
        ...over,
    };
}

beforeEach(() => resetPopupForTests());

it("opens a bubble for the word the finger came down on and stayed on", () => {
    recordWordTouch(touch());
    expect(holdAt(121, 302, NOW + 450)).toBe(true);
    expect(getPopup()).toMatchObject({
        word: "platform",
        context: "Find the right platform.",
        x: 120,
        y: 300,
    });
});

it("does nothing when the finger did not come down on a word", () => {
    expect(holdAt(120, 300, NOW)).toBe(false);
    expect(getPopup()).toBeNull();
});

it("ignores a word left behind by an earlier touch", () => {
    recordWordTouch(touch());
    expect(holdAt(120, 300, NOW + 5000)).toBe(false);
    expect(getPopup()).toBeNull();
});

it("ignores a word that is somewhere else on the screen", () => {
    recordWordTouch(touch());
    expect(holdAt(120, 400, NOW + 450)).toBe(false);
});

it("answers a recorded word once only", () => {
    recordWordTouch(touch());
    expect(holdAt(120, 300, NOW + 450)).toBe(true);
    closePopup();
    expect(holdAt(120, 300, NOW + 460)).toBe(false);
});

it("knows which native touch a word belongs to, and forgets it when told", () => {
    recordWordTouch(touch({ eventTime: 42 }));
    expect(isWordTouch(42)).toBe(true);
    expect(isWordTouch(43)).toBe(false);
    clearWordTouch();
    expect(isWordTouch(42)).toBe(false);
});

it("moves the bubble to a second word rather than stacking, with a new id", () => {
    recordWordTouch(touch());
    holdAt(120, 300, NOW + 450);
    const first = getPopup();

    recordWordTouch(touch({ word: "alight", x: 40, y: 600, at: NOW + 2000 }));
    holdAt(40, 600, NOW + 2450);
    expect(getPopup()?.word).toBe("alight");
    expect(getPopup()?.id).not.toBe(first?.id);
});
