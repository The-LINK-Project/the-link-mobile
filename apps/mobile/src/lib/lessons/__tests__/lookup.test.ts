import { mrtBasics } from "../data/mrt-basics";
import { normalize } from "../grading";
import { localized } from "../localized";
import { choiceText, phraseById, picturableVocab, vocabByIds } from "../lookup";
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
            ...(exercise.type === "selectPicture"
                ? [exercise.vocabId, ...exercise.choiceVocabIds]
                : []),
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

describe("phraseById", () => {
    it("resolves the sentence an exercise builds towards", () => {
        expect(phraseById(mrtBasics, "p-top-up-ten")?.text).toBe("I want to top up ten dollars.");
    });

    it("throws in development on a reference that matches nothing", () => {
        expect(() => phraseById(mrtBasics, "p-nope")).toThrow(/p-nope/);
    });

    it("points every sentence exercise at a phrase the lesson defines", () => {
        for (const exercise of mrtBasics.exercises) {
            if (exercise.type !== "arrangeWords" && exercise.type !== "translateWordBank") continue;
            expect(() => phraseById(mrtBasics, exercise.phraseId)).not.toThrow();
        }
    });
});

describe("picturableVocab", () => {
    it("returns items that have a picture", () => {
        const items = picturableVocab(mrtBasics, ["v-platform", "v-exit"]);
        expect(items.map((item) => item.picture)).toEqual(["platform", "exit"]);
    });

    it("throws in development when an option cannot be drawn", () => {
        // An option with no picture renders as an empty tile, which silently
        // reduces the number of choices and can remove the answer itself.
        expect(() => picturableVocab(mrtBasics, ["v-platform", "v-tap-out"])).toThrow(/v-tap-out/);
    });
});

describe("picture exercises", () => {
    it("only offers options that can actually be drawn", () => {
        for (const exercise of mrtBasics.exercises) {
            if (exercise.type !== "selectPicture") continue;
            expect(() => picturableVocab(mrtBasics, exercise.choiceVocabIds)).not.toThrow();
        }
    });

    it("always includes the answer among the options", () => {
        for (const exercise of mrtBasics.exercises) {
            if (exercise.type !== "selectPicture") continue;
            expect(exercise.choiceVocabIds).toContain(exercise.vocabId);
        }
    });

    it("offers options that look distinguishable from one another", () => {
        // Two tiles drawing the same picture would make the exercise unfair
        // rather than harder: a wrong answer the learner could not have avoided.
        for (const exercise of mrtBasics.exercises) {
            if (exercise.type !== "selectPicture") continue;
            const pictures = picturableVocab(mrtBasics, exercise.choiceVocabIds).map(
                (item) => item.picture,
            );
            expect(new Set(pictures).size).toBe(pictures.length);
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
            for (const word of exercise.tokens.flatMap((token) => normalize(token).split(" "))) {
                available.set(word, (available.get(word) ?? 0) + 1);
            }

            // Punctuation lives on the phrase ("... ten dollars.") but never on
            // a tile, so compare normalized words.
            const target = normalize(phraseById(mrtBasics, exercise.phraseId)!.text);
            for (const word of target.split(" ")) {
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
