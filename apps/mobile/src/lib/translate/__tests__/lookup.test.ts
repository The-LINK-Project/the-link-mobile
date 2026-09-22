import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiError, api } from "@/lib/api";
import { mrtBasics } from "@/lib/lessons/data/mrt-basics";
import type { Lesson } from "@/lib/lessons/types";

import { resetTranslationCacheForTests } from "../cache";
import { resetGlossaryForTests } from "../glossary";
import {
    TranslationError,
    fitContext,
    lookupTranslation,
    resetTranslationLookupsForTests,
} from "../lookup";
import { MAX_CONTEXT } from "../tokens";

// A stand-in for the API client rather than the real one behind a mocked fetch:
// this test is about which of the three sources answers, not about HTTP.
jest.mock("@/lib/api", () => {
    class MockApiError extends Error {
        status: number;
        constructor(status: number, message: string) {
            super(message);
            this.status = status;
        }
    }
    return { ApiError: MockApiError, api: { translate: jest.fn() } };
});

const mockContent: { lessons: Lesson[] } = { lessons: [] };
jest.mock("@/lib/lessons/data", () => ({ listLessons: () => mockContent.lessons }));

const translate = api.translate as unknown as jest.Mock;
const SENTENCE = "Stand on the left of the escalator.";

/** Lets the glossary and the cache have their turn, so the request is really out. */
const untilAsked = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
    await AsyncStorage.clear();
    resetTranslationCacheForTests();
    resetTranslationLookupsForTests();
    mockContent.lessons = [mrtBasics];
    resetGlossaryForTests();
    translate.mockReset().mockResolvedValue({
        word: "escalator",
        translation: "এসকেলেটর",
        phrase: null,
    });
});

it("answers from the lesson without asking the server", async () => {
    const found = await lookupTranslation({
        word: "platform",
        context: "The platform is over there.",
        language: "bn",
    });

    expect(found.source).toBe("glossary");
    expect(translate).not.toHaveBeenCalled();
});

it("asks the server for a word no lesson teaches, then remembers it", async () => {
    const first = await lookupTranslation({
        word: "escalator",
        context: SENTENCE,
        language: "bn",
    });
    expect(first).toEqual({
        word: "escalator",
        translation: "এসকেলেটর",
        phrase: null,
        source: "network",
    });

    const second = await lookupTranslation({
        word: "escalator",
        context: SENTENCE,
        language: "bn",
    });
    expect(second.source).toBe("cache");
    expect(translate).toHaveBeenCalledTimes(1);
});

it("sends the sentence the word was held in", async () => {
    await lookupTranslation({ word: "escalator", context: SENTENCE, language: "bn" });

    expect(translate).toHaveBeenCalledWith(
        { word: "escalator", context: SENTENCE, language: "bn" },
        expect.objectContaining({ signal: expect.anything() }),
    );
});

describe("a word held in a long paragraph", () => {
    // The server answers 400 to a context over its limit, which the learner
    // would see as "we could not translate this word" on every long screen.
    const filler = "We keep this part only to make the paragraph long. ".repeat(8);

    it("sends only the sentence the word is in", async () => {
        const paragraph = `${filler}Stand on the left of the escalator. ${filler}`;
        await lookupTranslation({ word: "escalator", context: paragraph, language: "bn" });

        expect(translate).toHaveBeenCalledWith(
            { word: "escalator", context: SENTENCE, language: "bn" },
            expect.anything(),
        );
    });

    it("cuts one endless sentence down around the word, at whole words", () => {
        const before = "alpha ".repeat(60);
        const after = " omega".repeat(60);
        const cut = fitContext("escalator", `${before}escalator${after}`);

        expect(cut.length).toBeLessThanOrEqual(MAX_CONTEXT);
        expect(cut).toContain("escalator");
        expect(cut.split(" ").every((part) => ["alpha", "omega", "escalator"].includes(part))).toBe(
            true,
        );
    });

    it("sends nothing rather than a paragraph the word is not in", () => {
        expect(fitContext("escalator", filler)).toBe("");
    });

    it("leaves a text that already fits exactly as it was", () => {
        expect(fitContext("left", "Stand  on the\nleft.")).toBe("Stand  on the\nleft.");
    });
});

it("calls a request that never left the phone what it is", async () => {
    translate.mockRejectedValue(new ApiError(0, "Network error"));

    await expect(
        lookupTranslation({ word: "escalator", context: SENTENCE, language: "bn" }),
    ).rejects.toMatchObject({ name: "TranslationError", reason: "offline" });
});

it("treats anything the server refuses as a failure to translate", async () => {
    translate.mockRejectedValue(new ApiError(503, "No model configured"));

    await expect(
        lookupTranslation({ word: "escalator", context: SENTENCE, language: "bn" }),
    ).rejects.toMatchObject({ reason: "failed" });
});

it("does not trust an answer it cannot show", async () => {
    translate.mockResolvedValue({ word: "escalator", translation: "", phrase: null });

    await expect(
        lookupTranslation({ word: "escalator", context: SENTENCE, language: "bn" }),
    ).rejects.toBeInstanceOf(TranslationError);
    // Nothing unusable is kept, so the next hold asks again.
    translate.mockResolvedValue({ word: "escalator", translation: "এসকেলেটর", phrase: null });
    const found = await lookupTranslation({
        word: "escalator",
        context: SENTENCE,
        language: "bn",
    });
    expect(found.source).toBe("network");
});

it("ignores an expression the server sent in pieces", async () => {
    translate.mockResolvedValue({
        word: "top",
        translation: "উপরে",
        phrase: { text: "top up" },
    });

    await expect(
        lookupTranslation({ word: "top", context: "Top up your card.", language: "bn" }),
    ).rejects.toMatchObject({ reason: "failed" });
});

it("asks once for the same word held twice at the same moment", async () => {
    let answer: (value: unknown) => void = () => undefined;
    translate.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const first = lookupTranslation({ word: "escalator", context: SENTENCE, language: "bn" });
    const second = lookupTranslation({ word: "escalator", context: SENTENCE, language: "bn" });
    answer({ word: "escalator", translation: "এসকেলেটর", phrase: null });

    expect(await first).toEqual(await second);
    expect(translate).toHaveBeenCalledTimes(1);
});

describe("a learner who lets go", () => {
    it("refuses a lookup that was already cancelled", async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(
            lookupTranslation({
                word: "escalator",
                context: SENTENCE,
                language: "bn",
                signal: controller.signal,
            }),
        ).rejects.toMatchObject({ name: "AbortError" });
        expect(translate).not.toHaveBeenCalled();
    });

    it("stops waiting, stops asking, and keeps nothing", async () => {
        const controller = new AbortController();
        let signal: AbortSignal | undefined;
        translate.mockImplementation(
            (_input: unknown, options: { signal?: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    signal = options.signal;
                    options.signal?.addEventListener("abort", () => {
                        const error = new Error("Aborted");
                        error.name = "AbortError";
                        reject(error);
                    });
                }),
        );

        const lookup = lookupTranslation({
            word: "escalator",
            context: SENTENCE,
            language: "bn",
            signal: controller.signal,
        });
        await untilAsked();
        controller.abort();

        await expect(lookup).rejects.toMatchObject({ name: "AbortError" });
        // The request itself is dropped too: nobody is waiting for the answer.
        expect(signal?.aborted).toBe(true);
    });

    it("keeps asking for a word somebody else is still waiting on", async () => {
        let answer: (value: unknown) => void = () => undefined;
        translate.mockReturnValue(new Promise((resolve) => (answer = resolve)));
        const controller = new AbortController();

        const leaving = lookupTranslation({
            word: "escalator",
            context: SENTENCE,
            language: "bn",
            signal: controller.signal,
        });
        const staying = lookupTranslation({ word: "escalator", context: SENTENCE, language: "bn" });
        await untilAsked();
        controller.abort();
        await expect(leaving).rejects.toMatchObject({ name: "AbortError" });

        answer({ word: "escalator", translation: "এসকেলেটর", phrase: null });
        expect(await staying).toMatchObject({ translation: "এসকেলেটর", source: "network" });
    });
});
