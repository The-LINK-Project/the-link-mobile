import { gradeAnswer, meaningfulWords, missingKeywords, normalize } from "../grading";
import { mrtBasics } from "../data/mrt-basics";
import type {
    ArrangeWordsExercise,
    DialogueChoiceExercise,
    FillBlankExercise,
    ListenArrangeWordsExercise,
    ListenChooseMeaningExercise,
    MatchPairsExercise,
    PictureToWordExercise,
    SelectPictureExercise,
} from "../types";

const arrange = mrtBasics.exercises.find(
    (exercise): exercise is ArrangeWordsExercise => exercise.type === "arrangeWords",
)!;
const fill = mrtBasics.exercises.find(
    (exercise): exercise is FillBlankExercise => exercise.type === "fillBlank",
)!;
const listen = mrtBasics.exercises.find(
    (exercise): exercise is ListenChooseMeaningExercise => exercise.type === "listenChooseMeaning",
)!;
const picture = mrtBasics.exercises.find(
    (exercise): exercise is SelectPictureExercise => exercise.type === "selectPicture",
)!;
const pairs = mrtBasics.exercises.find(
    (exercise): exercise is MatchPairsExercise => exercise.type === "matchPairs",
)!;

describe("normalize", () => {
    it("strips punctuation, case and extra spacing", () => {
        expect(normalize("  Which PLATFORM,  for Jurong East?? ")).toBe(
            "which platform for jurong east",
        );
    });

    it("keeps non-Latin scripts intact", () => {
        expect(normalize("ভাড়া!")).toBe("ভাড়া");
    });
});

describe("meaningfulWords", () => {
    it("drops articles and Singapore spoken particles", () => {
        expect(meaningfulWords("the fare lah, please")).toEqual(["fare"]);
    });
});

describe("missingKeywords", () => {
    it("accepts keywords in any order", () => {
        expect(
            missingKeywords("dollars ten top up want", ["want", "top up", "ten", "dollars"]),
        ).toEqual([]);
    });

    it("requires a multi-word keyword to appear as a phrase", () => {
        // "top" alone must not satisfy "top up".
        expect(missingKeywords("I want to top ten dollars", ["top up"])).toEqual(["top up"]);
        expect(missingKeywords("I want to top up ten dollars", ["top up"])).toEqual([]);
    });

    it("forgives small misspellings in longer words", () => {
        expect(missingKeywords("which platfrom for jurong east", ["platform"])).toEqual([]);
    });

    it("does not confuse short words that mean opposite things", () => {
        // "in" must never be accepted for "out" — they are the whole point of the
        // tap in / tap out distinction.
        expect(missingKeywords("remember to tap in", ["out"])).toEqual(["out"]);
    });

    it("reports every keyword that is absent", () => {
        expect(missingKeywords("I want dollars", ["want", "top up", "ten", "dollars"])).toEqual([
            "top up",
            "ten",
        ]);
    });
});

describe("gradeAnswer", () => {
    it("accepts jumbled but understandable word order", () => {
        const result = gradeAnswer(mrtBasics, arrange, {
            kind: "tokens",
            tokens: ["I", "want", "top up", "ten", "dollars"],
        });
        expect(result.correct).toBe(true);
        // Right words, not the model sentence: acknowledged rather than marked wrong.
        expect(result.accepted).toBe(true);
        expect(result.modelAnswer).toBe("I want to top up ten dollars.");
    });

    it("marks a word-perfect answer as correct without the accepted flag", () => {
        const result = gradeAnswer(mrtBasics, arrange, {
            kind: "tokens",
            tokens: ["I", "want", "to", "top up", "ten", "dollars"],
        });
        expect(result.correct).toBe(true);
        expect(result.accepted).toBe(false);
    });

    it("rejects an answer that drops a required word and says which", () => {
        const result = gradeAnswer(mrtBasics, arrange, {
            kind: "tokens",
            tokens: ["I", "want", "dollars"],
        });
        expect(result.correct).toBe(false);
        expect(result.missing).toEqual(["top up", "ten"]);
    });

    it("ignores decoy tiles that do not change the meaning", () => {
        const result = gradeAnswer(mrtBasics, arrange, {
            kind: "tokens",
            tokens: ["I", "want", "to", "top up", "ten", "dollars", "tomorrow"],
        });
        expect(result.correct).toBe(true);
    });

    it("grades single-choice exercises against the recorded answer", () => {
        expect(gradeAnswer(mrtBasics, fill, { kind: "choice", choiceId: "f-out" }).correct).toBe(
            true,
        );
        expect(gradeAnswer(mrtBasics, fill, { kind: "choice", choiceId: "f-in" }).correct).toBe(
            false,
        );
        expect(
            gradeAnswer(mrtBasics, listen, { kind: "choice", choiceId: listen.correctChoiceId })
                .correct,
        ).toBe(true);
    });

    it("returns the model answer for a wrong choice so feedback can show it", () => {
        expect(gradeAnswer(mrtBasics, fill, { kind: "choice", choiceId: "f-up" }).modelAnswer).toBe(
            "out",
        );
    });

    it("passes a completed matching exercise and flags a messy run", () => {
        expect(gradeAnswer(mrtBasics, pairs, { kind: "pairs", wrongAttempts: 0 })).toMatchObject({
            correct: true,
            accepted: false,
            firstPassClean: true,
        });
        // Still a pass: a wrong pairing is corrected in the moment. But it was
        // not a clean first pass, so the summary must not count it as one.
        expect(gradeAnswer(mrtBasics, pairs, { kind: "pairs", wrongAttempts: 2 })).toMatchObject({
            correct: true,
            accepted: true,
            firstPassClean: false,
        });
    });

    it("labels the listening reveal as the audio rather than a rephrasing", () => {
        // The learner never saw this word, so showing it teaches it. Calling it
        // "another way to say it" would be wrong: it rephrases nothing.
        const result = gradeAnswer(mrtBasics, listen, { kind: "choice", choiceId: "c-wrong-1" });
        expect(result.modelAnswer).toBe(listen.audioText);
        expect(result.modelAnswerKind).toBe("audio");
    });

    it("does not label a word-bank model answer as audio", () => {
        expect(
            gradeAnswer(mrtBasics, arrange, { kind: "tokens", tokens: ["I"] }).modelAnswerKind,
        ).toBe(undefined);
    });

    it("grades a picture choice against the word being asked about", () => {
        expect(
            gradeAnswer(mrtBasics, picture, { kind: "choice", choiceId: picture.vocabId }).correct,
        ).toBe(true);
        expect(
            gradeAnswer(mrtBasics, picture, { kind: "choice", choiceId: "v-exit" }).correct,
        ).toBe(false);
    });

    it("offers no written solution for a picture exercise", () => {
        // The word is the prompt, on screen the whole time. Repeating it as a
        // "correct solution" would tell the learner nothing.
        expect(
            gradeAnswer(mrtBasics, picture, { kind: "choice", choiceId: "v-exit" }).modelAnswer,
        ).toBe("");
    });

    it("can require an exact sentence when order carries the meaning", () => {
        const strict = {
            ...arrange,
            grading: { mode: "exactSentence" } as const,
        };

        expect(
            gradeAnswer(mrtBasics, strict, {
                kind: "tokens",
                tokens: ["I", "want", "to", "top up", "ten", "dollars"],
            }).correct,
        ).toBe(true);
        // The same words in a different order no longer pass.
        expect(
            gradeAnswer(mrtBasics, strict, {
                kind: "tokens",
                tokens: ["ten", "dollars", "I", "want", "to", "top up"],
            }).correct,
        ).toBe(false);
    });

    it("treats a mismatched answer shape as wrong rather than throwing", () => {
        expect(gradeAnswer(mrtBasics, arrange, { kind: "choice", choiceId: "nope" }).correct).toBe(
            false,
        );
    });
});

describe("newer exercise types", () => {
    const byType = <T extends { type: string }>(type: string) =>
        mrtBasics.exercises.find((exercise) => exercise.type === type) as unknown as T;

    it("grades a picture-to-word choice against the word being asked about", () => {
        const exercise = byType<PictureToWordExercise>("pictureToWord");
        expect(
            gradeAnswer(mrtBasics, exercise, { kind: "choice", choiceId: exercise.vocabId })
                .correct,
        ).toBe(true);
        expect(
            gradeAnswer(mrtBasics, exercise, { kind: "choice", choiceId: "v-platform" }).correct,
        ).toBe(false);
        // The picture stays on screen, so there is no written solution to add.
        expect(
            gradeAnswer(mrtBasics, exercise, { kind: "choice", choiceId: "x" }).modelAnswer,
        ).toBe("");
    });

    it("labels the listen-and-build reveal as what was heard", () => {
        const exercise = byType<ListenArrangeWordsExercise>("listenArrangeWords");
        const result = gradeAnswer(mrtBasics, exercise, { kind: "tokens", tokens: ["I", "want"] });
        expect(result.correct).toBe(false);
        expect(result.modelAnswerKind).toBe("audio");
        expect(result.modelAnswer).toBe("Excuse me, I want to alight here.");
    });

    it("grades a dialogue reply against the taught phrase", () => {
        const exercise = byType<DialogueChoiceExercise>("dialogueChoice");
        expect(
            gradeAnswer(mrtBasics, exercise, { kind: "choice", choiceId: exercise.phraseId })
                .correct,
        ).toBe(true);
        const wrong = gradeAnswer(mrtBasics, exercise, {
            kind: "choice",
            choiceId: exercise.distractors[0].id,
        });
        expect(wrong.correct).toBe(false);
        expect(wrong.modelAnswer).toBe("My card cannot tap. Can you help me?");
    });
});
