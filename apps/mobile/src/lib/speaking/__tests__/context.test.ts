import { mrtBasics } from "@/lib/lessons/data/mrt-basics";

import {
    buildSpeakingContext,
    practiceLanguages,
    runFromParams,
    runToParams,
    TUTOR_LANGUAGES,
} from "../context";

const wholeLesson = runFromParams(mrtBasics, {});

/** Same tokenising as the API's word rule: any run of Latin letters is English. */
function englishWords(text: string): string[] {
    return text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? [];
}

describe("speaking practice context", () => {
    it("asks only for sentences and words the run taught", () => {
        const run = { vocabIds: ["v-tap-out"], phraseIds: ["p-top-up-ten"] };
        const context = buildSpeakingContext(mrtBasics, run, "bn")!;

        expect(context.goals.map((goal) => goal.id)).toEqual(["say-top-up", "say-tap-out"]);
        expect(context.words).toEqual(["tap out"]);
        expect(context.phrases).toEqual(["I want to top up ten dollars."]);
    });

    it("asks for each goal by its meaning in the learner's language", () => {
        const context = buildSpeakingContext(mrtBasics, wholeLesson, "ta")!;
        const platform = context.goals.find((goal) => goal.id === "say-platform")!;
        const phrase = mrtBasics.phrases.find((item) => item.id === "p-which-platform")!;

        expect(platform.target).toBe("Which platform for Jurong East?");
        expect(platform.ask).toBe(phrase.meaning.ta);
    });

    it("has nothing to practise when the run taught none of the goals", () => {
        const empty = { vocabIds: [], phraseIds: [] };
        expect(buildSpeakingContext(mrtBasics, empty, "bn")).toBeNull();
        expect(practiceLanguages(mrtBasics, empty)).toEqual([]);
    });

    it("carries a run through route params, and treats a missing run as the whole lesson", () => {
        const run = { vocabIds: ["v-platform", "v-alight"], phraseIds: ["p-which-platform"] };
        expect(runFromParams(mrtBasics, runToParams(run))).toEqual(run);
        expect(wholeLesson.phraseIds).toEqual(["p-top-up-ten", "p-which-platform"]);
    });

    // The API refuses a goal whose wording uses English the lesson did not teach,
    // which would break practice for every learner, so the data is checked here.
    it.each([...TUTOR_LANGUAGES])(
        "keeps every %s goal inside the English it teaches",
        (language) => {
            const context = buildSpeakingContext(mrtBasics, wholeLesson, language)!;
            const allowed = new Set(
                ["a", "an", "the", "and"]
                    .concat(
                        [...context.words, ...context.phrases, ...context.names].flatMap(
                            englishWords,
                        ),
                    )
                    .map((word) => word.toLowerCase()),
            );

            expect(context.goals).toHaveLength(4);
            for (const goal of context.goals) {
                const used = englishWords([goal.target, ...goal.keywords, goal.ask].join(" "));
                expect(used.filter((word) => !allowed.has(word.toLowerCase()))).toEqual([]);
            }
        },
    );
});
