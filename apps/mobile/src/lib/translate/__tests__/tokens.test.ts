/**
 * Splitting text into holdable words: exact, and quick to say no.
 */

import { sentenceAround, tokenize } from "../tokens";

const words = (text: string) =>
    tokenize(text)
        .filter((token) => token.word)
        .map((token) => token.text);

describe("tokenize", () => {
    it.each([
        "Find the right platform, top up your card, and get off at the right stop.",
        "  leading and trailing spaces  ",
        "Lessons done: 2 of 4",
        "Don’t worry — it's 10-minute work, e.g. at 9am!",
        "Write to hello@thelinkproject.org or see www.thelinkproject.org/privacy",
        "আমি MRT নিই",
        "line one\nline two\n\nline four",
        "",
    ])("gives the text back exactly when joined: %j", (text) => {
        expect(
            tokenize(text)
                .map((token) => token.text)
                .join(""),
        ).toBe(text);
    });

    it("finds the words and leaves the punctuation between them", () => {
        expect(words("Find the right platform, top up your card.")).toEqual([
            "Find",
            "the",
            "right",
            "platform",
            "top",
            "up",
            "your",
            "card",
        ]);
    });

    it("never puts two pieces that are not words side by side", () => {
        const tokens = tokenize("Wait... what?! (10 minutes) — yes");
        tokens.slice(1).forEach((token, index) => {
            expect(token.word || tokens[index].word).toBe(true);
        });
    });

    it("keeps an apostrophe or a hyphen inside a word, and quotation marks outside it", () => {
        expect(words("Don't top-up at o’clock, 'please'")).toEqual([
            "Don't",
            "top-up",
            "at",
            "o’clock",
            "please",
        ]);
    });

    it("does nothing at all to text with no Latin letters in it", () => {
        expect(tokenize("প্ল্যাটফর্ম কোথায়?")).toEqual([
            { text: "প্ল্যাটফর্ম কোথায়?", word: false },
        ]);
        expect(tokenize("2 / 4 — 50%")).toEqual([{ text: "2 / 4 — 50%", word: false }]);
    });

    it("picks the English out of a sentence in another script", () => {
        expect(words("আমি platform খুঁজছি")).toEqual(["platform"]);
    });

    it("refuses anything with a digit in it, but keeps the word beside a number", () => {
        expect(words("Take MRT3 at 9am from A1")).toEqual(["Take", "at", "from"]);
        expect(words("a 10-minute walk")).toEqual(["a", "minute", "walk"]);
    });

    it("refuses single letters, except the two that are words", () => {
        expect(words("I have a plan B or C")).toEqual(["I", "have", "a", "plan", "or"]);
    });

    it("refuses email addresses, web addresses and usernames whole", () => {
        expect(words("Write to hello@thelinkproject.org today")).toEqual(["Write", "to", "today"]);
        expect(words("See www.thelinkproject.org/privacy or https://example.com/a now")).toEqual([
            "See",
            "or",
            "now",
        ]);
        expect(words("Signed in as worker_77")).toEqual(["Signed", "in", "as"]);
    });

    it("cannot tell a hyphenated username from a hyphenated word", () => {
        // The reason `Text` has a `translatable` prop: no rule here can know
        // that this is somebody's name, so whoever draws it has to say so.
        expect(words("adrish-dev")).toEqual(["adrish-dev"]);
    });

    it("refuses a run too long to be a word", () => {
        expect(words(`see ${"a".repeat(41)} here`)).toEqual(["see", "here"]);
    });
});

describe("sentenceAround", () => {
    const text = "Tap in at the gate. I want to top up ten dollars. Then find your platform.";
    const at = (word: string) => {
        const start = text.indexOf(word);
        return [start, start + word.length] as const;
    };

    it("sends the sentence the word is in, not the whole paragraph", () => {
        expect(sentenceAround(text, ...at("top"))).toBe("I want to top up ten dollars.");
        expect(sentenceAround(text, ...at("Tap"))).toBe("Tap in at the gate.");
        expect(sentenceAround(text, ...at("platform"))).toBe("Then find your platform.");
    });

    it("treats a line break as the end of a sentence", () => {
        expect(sentenceAround("tap out\nalight", 8, 14)).toBe("alight");
    });

    it("cuts an overlong sentence to what the API accepts, around the word, on whole words", () => {
        const long = `${"word ".repeat(80)}platform ${"more ".repeat(80)}`.trim();
        const start = long.indexOf("platform");
        const context = sentenceAround(long, start, start + "platform".length);
        expect(context.length).toBeLessThanOrEqual(300);
        expect(context).toContain("platform");
        expect(
            context.split(" ").every((piece) => ["word", "platform", "more"].includes(piece)),
        ).toBe(true);
    });
});
