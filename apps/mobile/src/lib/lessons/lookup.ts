/**
 * Resolving references inside a lesson.
 *
 * Exercises point at vocabulary by id instead of restating terms and meanings.
 * That keeps one authored copy of every translation, and these functions turn a
 * reference back into content when a component needs to draw it.
 */

import type { Lesson, MeaningChoice, VocabItem } from "./types";

/**
 * Vocabulary items for the given ids, in the order asked for.
 *
 * An id that matches nothing is dropped rather than rendered as a blank tile.
 * In development this also throws, because a dangling reference is an authoring
 * mistake that should be caught while writing the lesson, not shipped as a
 * silently shorter exercise.
 */
export function vocabByIds(lesson: Lesson, ids: string[]): VocabItem[] {
    const byId = new Map(lesson.vocab.map((item) => [item.id, item]));
    const missing = ids.filter((id) => !byId.has(id));

    if (missing.length > 0) {
        const message = `Lesson "${lesson.id}" references unknown vocabulary: ${missing.join(", ")}`;
        if (__DEV__) throw new Error(message);
        console.warn(message);
    }

    return ids.map((id) => byId.get(id)).filter((item): item is VocabItem => item !== undefined);
}

/**
 * The text to show for one meaning choice.
 *
 * Returns the localizable value; the caller resolves it into a language. A
 * taught meaning comes from vocabulary, a distractor carries its own text.
 */
export function choiceText(lesson: Lesson, choice: MeaningChoice) {
    if (choice.label) return choice.label;

    const [item] = vocabByIds(lesson, [choice.vocabId]);
    // Falls back to the id only if the reference is dangling, which already
    // threw in development.
    return item?.meaning ?? { en: choice.vocabId };
}
