import { mrtBasics } from "../data/mrt-basics";
import { localized } from "../localized";
import { choiceText, vocabByIds } from "../lookup";
import type { Lesson, MeaningChoice } from "../types";

describe("vocabByIds", () => {
    it("returns the requested items in the order asked for", () => {
        const items = vocabByIds(mrtBasics, ["v-exit", "v-platform"]);
        expect(items.map((item) => item.term)).toEqual(["exit", "platform"]);
    });

    it("throws in development on a reference that matches nothing", () => {
        // A dangling reference is an authoring mistake. Failing loudly while
        // writing the lesson beats shipping an exercise that is quietly short.
        expect(() => vocabByIds(mrtBasics, ["v-platform", "v-nope"])).toThrow(/v-nope/);
    });

    it("drops unknown ids instead of failing outside development", () => {
        const wasDev = __DEV__;
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        try {
            (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
            expect(vocabByIds(mrtBasics, ["v-nope", "v-exit"]).map((i) => i.term)).toEqual([
                "exit",
            ]);
            expect(warn).toHaveBeenCalled();
        } finally {
            (globalThis as unknown as { __DEV__: boolean }).__DEV__ = wasDev;
            warn.mockRestore();
        }
    });
});

describe("choiceText", () => {
    it("reads a taught meaning from the lesson vocabulary", () => {
        const choice: MeaningChoice = { id: "c", vocabId: "v-top-up" };
        expect(localized(choiceText(mrtBasics, choice), "en")).toBe("add money to your card");
    });

    it("uses its own text for a distractor", () => {
        const choice: MeaningChoice = { id: "c", label: { en: "Wait for the next train" } };
        expect(localized(choiceText(mrtBasics, choice), "en")).toBe("Wait for the next train");
    });

    it("follows the learner's language, falling back to English", () => {
        const choice: MeaningChoice = { id: "c", vocabId: "v-top-up" };
        expect(localized(choiceText(mrtBasics, choice), "bn")).toBe("কার্ডে টাকা ভরা");
        // Burmese has no lesson content authored yet.
        expect(localized(choiceText(mrtBasics, choice), "bu")).toBe("add money to your card");
    });
});

describe("content model", () => {
    it("keeps one authored copy of every meaning", () => {
        // Exercises reference vocabulary by id. If an exercise ever restates a
        // meaning, the two copies can drift apart silently.
        const meanings = mrtBasics.vocab.map((item) => item.meaning.en);
        expect(new Set(meanings).size).toBe(meanings.length);
    });

    it("references only vocabulary the lesson defines", () => {
        const known = new Set(mrtBasics.vocab.map((item) => item.id));
        const referenced = mrtBasics.exercises.flatMap((exercise) => [
            ...exercise.practises,
            ...(exercise.type === "matchPairs" ? exercise.vocabIds : []),
            ...(exercise.type === "listenChooseMeaning"
                ? exercise.choices.flatMap((choice) => (choice.vocabId ? [choice.vocabId] : []))
                : []),
        ]);

        expect(referenced.filter((id) => !known.has(id))).toEqual([]);
    });

    it("marks every translated string as needing a native speaker's review", () => {
        const translated: { reviewed: boolean }[] = [
            ...mrtBasics.notes,
            ...mrtBasics.vocab,
            ...mrtBasics.phrases,
        ];
        expect(translated.every((item) => item.reviewed === false)).toBe(true);
    });

    it("never offers a choice that repeats the audio it is testing", () => {
        // "top up" as a distractor for "tap out" made this a pronunciation trap.
        for (const exercise of mrtBasics.exercises) {
            if (exercise.type !== "listenChooseMeaning") continue;
            const audio = exercise.audioText.toLowerCase();
            for (const choice of exercise.choices) {
                expect(localized(choiceText(mrtBasics, choice), "en").toLowerCase()).not.toContain(
                    audio,
                );
            }
        }
    });
});

describe("lesson shape", () => {
    it("gives every exercise a unique id", () => {
        const ids = (mrtBasics as Lesson).exercises.map((exercise) => exercise.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("offers enough word-bank tiles to build each target sentence", () => {
        for (const exercise of mrtBasics.exercises) {
            if (exercise.type !== "arrangeWords" && exercise.type !== "translateWordBank") continue;

            // Tiles may be phrases ("Jurong East"), so compare word multisets
            // rather than tiles to words. Counting consumes each word once, so
            // a sentence needing a word twice cannot pass on a single tile, and
            // "ten" cannot be satisfied by a tile that merely contains it.
            const available = new Map<string, number>();
            for (const word of exercise.tokens.flatMap((token) => token.split(" "))) {
                available.set(word, (available.get(word) ?? 0) + 1);
            }

            for (const word of exercise.target.split(" ")) {
                const remaining = available.get(word) ?? 0;
                expect({ exercise: exercise.id, word, remaining }).toMatchObject({
                    remaining: expect.any(Number),
                });
                expect(remaining).toBeGreaterThan(0);
                available.set(word, remaining - 1);
            }
        }
    });
});
