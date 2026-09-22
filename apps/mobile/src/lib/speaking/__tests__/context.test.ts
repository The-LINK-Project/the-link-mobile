import { mrtBasics } from "@/lib/lessons/data/mrt-basics";
import { localized } from "@/lib/lessons/localized";

import {
    buildSpeakingContext,
    practiceLanguages,
    runFromParams,
    runToParams,
    TUTOR_LANGUAGES,
} from "../context";

const wholeLesson = runFromParams(mrtBasics, {});

/** Tutor languages the API cannot tell from English by their letters alone. */
const LATIN_SCRIPT = new Set(["fi", "in", "ms", "vi", "fr", "es"]);

/** Same tokenising as the API's word rule: any run of Latin letters is English. */
function englishWords(text: string): string[] {
    return text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? [];
}

describe("speaking practice context", () => {
    it("asks only for goals the run taught and allows every word from the lesson intro", () => {
        const run = { vocabIds: ["v-tap-out"], phraseIds: ["p-top-up-ten"] };
        const context = buildSpeakingContext(mrtBasics, run, "bn")!;

        expect(context.goals.map((goal) => goal.id)).toEqual(["say-top-up", "say-tap-out"]);
        expect(context.words).toEqual(mrtBasics.vocab.map((item) => item.term));
        expect(context.phrases).toEqual(["I want to top up ten dollars."]);
    });

    it("asks for each goal by its meaning in the learner's language", () => {
        const context = buildSpeakingContext(mrtBasics, wholeLesson, "ta")!;
        const platform = context.goals.find((goal) => goal.id === "say-platform")!;
        const phrase = mrtBasics.phrases.find((item) => item.id === "p-which-platform")!;

        expect(platform.target).toBe("Which platform for Jurong East?");
        expect(platform.ask).toBe(phrase.meaning.ta);
    });

    it("asks in the learner's language when the lesson is not authored in it", () => {
        const context = buildSpeakingContext(mrtBasics, wholeLesson, "te")!;
        const platform = context.goals.find((goal) => goal.id === "say-platform")!;
        const phrase = mrtBasics.phrases.find((item) => item.id === "p-which-platform")!;

        expect(platform.ask).toBe(localized(phrase.meaning, "te"));
        expect(platform.ask).not.toBe(phrase.meaning.en);
    });

    it("has nothing to practise when the run taught none of the goals", () => {
        const empty = { vocabIds: [], phraseIds: [] };
        expect(buildSpeakingContext(mrtBasics, empty, "bn")).toBeNull();
        expect(practiceLanguages(mrtBasics, empty)).toEqual([]);
    });

    it("carries a run through route params, and treats a missing run as the whole lesson", () => {
        const run = { vocabIds: ["v-platform", "v-alight"], phraseIds: ["p-which-platform"] };
        expect(runFromParams(mrtBasics, runToParams(run))).toEqual(run);
        // Every exercise that builds or picks a sentence counts as teaching it.
        expect(wholeLesson.phraseIds).toEqual([
            "p-top-up-ten",
            "p-card-cannot-tap",
            "p-which-platform",
            "p-alight-here",
        ]);
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
                // The API cannot tell a Latin-script language's own words from
                // English, so there it checks the target and keywords only.
                const checked = LATIN_SCRIPT.has(language)
                    ? [goal.target, ...goal.keywords]
                    : [goal.target, ...goal.keywords, goal.ask];
                const used = englishWords(checked.join(" "));
                expect(used.filter((word) => !allowed.has(word.toLowerCase()))).toEqual([]);
            }
        },
    );
});
