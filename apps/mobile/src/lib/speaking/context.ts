/**
 * What one speaking session practises, and the English the tutor may use.
 *
 * Speaking goals are built from the run: a learner is only asked to say a
 * sentence an exercise actually taught them. The tutor's vocabulary comes
 * from `lesson.vocab`, which is the exact list shown on the lesson intro, so it
 * may reuse every word the learner was introduced to without inventing new
 * English.
 */

import type { TutorTurnRequest } from "@/lib/api";
import {
    FIRST_LANGUAGES,
    FIRST_LANGUAGE_LABELS,
    type FirstLanguage,
} from "@/lib/firstLanguage/languages";
import { localized } from "@/lib/lessons/localized";
import { phraseById, vocabByIds } from "@/lib/lessons/lookup";
import type { Lesson, Localized, SpeakingGoal } from "@/lib/lessons/types";

export type TutorLanguage = TutorTurnRequest["language"];

/**
 * Languages the tutor teaches from. Each is written in a script of its own,
 * which is what lets the server pick out every English word and check it. A
 * language written in Latin letters could not be checked that way.
 */
export const TUTOR_LANGUAGES: readonly TutorLanguage[] = FIRST_LANGUAGES;

/** Each language by its own name, since the learner may not read English. */
export const TUTOR_LANGUAGE_LABELS: Record<TutorLanguage, string> = FIRST_LANGUAGE_LABELS;

/** What a finished run covered. */
export type PractisedRun = { vocabIds: string[]; phraseIds: string[] };

export type SpeakingContext = Omit<
    TutorTurnRequest,
    "goalIndex" | "attempt" | "asides" | "history" | "audio"
>;

function goalContent(
    lesson: Lesson,
    goal: SpeakingGoal,
): { target: string; meaning: Localized } | undefined {
    if (goal.phraseId !== undefined) {
        const phrase = phraseById(lesson, goal.phraseId);
        return phrase && { target: phrase.text, meaning: phrase.meaning };
    }
    const [item] = vocabByIds(lesson, [goal.vocabId]);
    return item && { target: item.term, meaning: item.meaning };
}

function wasTaught(goal: SpeakingGoal, run: PractisedRun): boolean {
    return goal.phraseId !== undefined
        ? run.phraseIds.includes(goal.phraseId)
        : run.vocabIds.includes(goal.vocabId);
}

function hasAuthoredTutorCopy(language: TutorLanguage): language is "bn" | "ta" | "hi" {
    return language === "bn" || language === "ta" || language === "hi";
}

/** Null when nothing in this run can be practised aloud in `language`. */
export function buildSpeakingContext(
    lesson: Lesson,
    run: PractisedRun,
    language: TutorLanguage,
): SpeakingContext | null {
    const practice = lesson.speaking;
    if (!practice) return null;

    const goals = practice.goals.flatMap((goal) => {
        const content = wasTaught(goal, run) ? goalContent(lesson, goal) : undefined;
        // The meaning is what the tutor asks for, and its line of last resort.
        // Falling back to English would be exactly the English this avoids.
        if (!content) return [];
        return [
            {
                id: goal.id,
                target: content.target,
                keywords: goal.keywords,
                // Bengali, Tamil and Hindi have authored lesson explanations.
                // For every other language, the target itself is the safe
                // fallback; Gemini is instructed to set it up and explain it
                // in the selected language without inventing other English.
                ask: hasAuthoredTutorCopy(language)
                    ? localized(content.meaning, language as FirstLanguage)
                    : content.target,
            },
        ];
    });
    if (goals.length === 0) return null;

    return {
        language,
        scene: practice.scene,
        // This is intentionally the same list, in the same order, as
        // LessonIntro. Even if an exercise did not happen to drill a word, the
        // learner already met it before starting the lesson.
        words: lesson.vocab.map((item) => item.term),
        phrases: lesson.phrases
            .filter((phrase) => run.phraseIds.includes(phrase.id))
            .map((phrase) => phrase.text),
        names: practice.names,
        goals,
    };
}

export function practiceLanguages(lesson: Lesson, run: PractisedRun): TutorLanguage[] {
    return TUTOR_LANGUAGES.filter((language) => buildSpeakingContext(lesson, run, language));
}

/** Route params can only carry strings. */
export function runToParams(run: PractisedRun) {
    return { words: run.vocabIds.join(","), phrases: run.phraseIds.join(",") };
}

export function runFromParams(
    lesson: Lesson,
    params: { words?: string; phrases?: string },
): PractisedRun {
    // Opened without a run, from a deep link or a restored stack: treat every
    // exercise as done rather than refusing to practise.
    if (params.words === undefined && params.phrases === undefined) {
        return {
            vocabIds: [...new Set(lesson.exercises.flatMap((exercise) => exercise.practises))],
            phraseIds: lesson.exercises.flatMap((exercise) =>
                "phraseId" in exercise ? [exercise.phraseId] : [],
            ),
        };
    }
    const ids = (value?: string) => (value ? value.split(",").filter(Boolean) : []);
    return { vocabIds: ids(params.words), phraseIds: ids(params.phrases) };
}
