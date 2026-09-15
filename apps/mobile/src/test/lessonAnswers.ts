/**
 * The right answer for any exercise, derived from the lesson content.
 *
 * Shared by the session, content and screen tests so that adding an exercise
 * type means adding one branch here rather than hand-writing answers in every
 * test. The switch has no default case: a new type fails to compile until it
 * has an answer, the same way the renderer and grader do.
 */

import { phraseById } from "@/lib/lessons/lookup";
import type { Answer, Exercise, Lesson } from "@/lib/lessons/types";

/** The words of a phrase as tiles would present them: multi-word tiles kept whole. */
function tokensFor(lesson: Lesson, phraseId: string, tokens: string[]): string[] {
    const sentence = phraseById(lesson, phraseId)?.text ?? "";
    const remaining = sentence
        .replace(/[^\p{L}\p{N}\s']/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
    const placed: string[] = [];
    // Greedy left-to-right: longest tile that matches the front of what is left.
    let rest = remaining;
    while (rest.length > 0) {
        const match = [...tokens]
            .sort((a, b) => b.length - a.length)
            .find((token) => rest.toLowerCase().startsWith(token.toLowerCase()));
        if (!match) throw new Error(`No tile for "${rest}" in ${phraseId}`);
        placed.push(match);
        rest = rest.slice(match.length).trim();
    }
    return placed;
}

export function correctAnswer(lesson: Lesson, exercise: Exercise): Answer {
    switch (exercise.type) {
        case "selectPicture":
        case "pictureToWord":
            return { kind: "choice", choiceId: exercise.vocabId };
        case "matchPairs":
            return { kind: "pairs", wrongAttempts: 0 };
        case "listenChooseMeaning":
        case "fillBlank":
            return { kind: "choice", choiceId: exercise.correctChoiceId };
        case "dialogueChoice":
            return { kind: "choice", choiceId: exercise.phraseId };
        case "arrangeWords":
        case "listenArrangeWords":
        case "translateWordBank":
            return {
                kind: "tokens",
                tokens: tokensFor(lesson, exercise.phraseId, exercise.tokens),
            };
    }
}
