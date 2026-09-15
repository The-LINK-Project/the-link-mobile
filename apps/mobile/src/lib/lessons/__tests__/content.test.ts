/**
 * Every lesson, checked the way a lesson editor would check it.
 *
 * Content is hand-written, and a dangling id or a keyword that is not in its
 * sentence would only show up when a learner reached that exercise. These
 * checks run over the whole catalogue so an authoring slip fails the build.
 */

import { correctAnswer } from "@/test/lessonAnswers";

import { listLessons } from "../data";
import { gradeAnswer, meaningfulWords, normalize } from "../grading";
import { dialogueReplies, phraseById, picturableVocab, vocabByIds } from "../lookup";
import type { Exercise, Lesson, Localized } from "../types";

const lessons = listLessons();
const LANGUAGES = ["bn", "ta", "hi"] as const;

/** English inside text meant to be in the learner's language. */
const LATIN = /[A-Za-z]+/g;

function english(text: string): string[] {
    return text.match(LATIN) ?? [];
}

/** Every English word a speaking goal may contain, the way the server allows them. */
function allowedEnglish(lesson: Lesson): Set<string> {
    const words = [
        "a",
        "an",
        "the",
        "and",
        ...lesson.vocab.map((item) => item.term),
        ...lesson.phrases.map((phrase) => phrase.text),
        ...(lesson.speaking?.names ?? []),
    ];
    return new Set(words.flatMap(english).map((word) => word.toLowerCase()));
}

function forEachLocalized(lesson: Lesson, visit: (value: Localized, where: string) => void) {
    visit(lesson.title, "title");
    visit(lesson.goal, "goal");
    lesson.notes.forEach((note) => visit(note.text, note.id));
    lesson.vocab.forEach((item) => visit(item.meaning, item.id));
    lesson.phrases.forEach((phrase) => visit(phrase.meaning, phrase.id));
    for (const exercise of lesson.exercises) {
        visit(exercise.instruction, exercise.id);
        if (exercise.type === "translateWordBank") visit(exercise.prompt, exercise.id);
        if (exercise.type === "dialogueChoice") {
            visit(exercise.situation, exercise.id);
            visit(exercise.lineMeaning, exercise.id);
            exercise.distractors.forEach((reply) => {
                if (reply.meaning) visit(reply.meaning, `${exercise.id}/${reply.id}`);
            });
        }
        if (exercise.type === "listenChooseMeaning") {
            exercise.choices.forEach((choice) => {
                if (choice.label) visit(choice.label, `${exercise.id}/${choice.id}`);
            });
        }
    }
}

describe("lesson catalogue", () => {
    it("has more than one lesson, each with a unique id", () => {
        expect(lessons.length).toBeGreaterThan(1);
        expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);
    });

    it("uses ids that are unique across every lesson, so the daily mix can merge them", () => {
        const seen = new Map<string, string>();
        for (const lesson of lessons) {
            const ids = [
                ...lesson.vocab.map((item) => item.id),
                ...lesson.phrases.map((phrase) => phrase.id),
                ...lesson.exercises.map((exercise) => exercise.id),
                ...lesson.notes.map((note) => note.id),
            ];
            for (const id of ids) {
                expect(`${id} in ${seen.get(id) ?? lesson.id}`).toBe(`${id} in ${lesson.id}`);
                seen.set(id, lesson.id);
            }
        }
    });
});

describe.each(lessons.map((lesson) => [lesson.id, lesson] as const))("lesson %s", (_, lesson) => {
    it("is translated into every tutor language, with no English left in", () => {
        forEachLocalized(lesson, (value, where) => {
            for (const language of LANGUAGES) {
                expect(`${where}.${language}: ${value[language] ?? ""}`).not.toBe(
                    `${where}.${language}: `,
                );
            }
        });
    });

    it("resolves every vocabulary, phrase and picture reference", () => {
        for (const exercise of lesson.exercises) {
            expect(vocabByIds(lesson, exercise.practises)).toHaveLength(exercise.practises.length);
            switch (exercise.type) {
                case "selectPicture":
                case "pictureToWord":
                    expect(exercise.choiceVocabIds).toContain(exercise.vocabId);
                    expect(picturableVocab(lesson, exercise.choiceVocabIds)).toHaveLength(
                        exercise.choiceVocabIds.length,
                    );
                    break;
                case "matchPairs":
                    expect(vocabByIds(lesson, exercise.vocabIds)).toHaveLength(
                        exercise.vocabIds.length,
                    );
                    break;
                case "listenChooseMeaning":
                    expect(exercise.choices.map((choice) => choice.id)).toContain(
                        exercise.correctChoiceId,
                    );
                    exercise.choices.forEach((choice) => {
                        if (choice.vocabId)
                            expect(vocabByIds(lesson, [choice.vocabId])).toHaveLength(1);
                    });
                    break;
                case "fillBlank":
                    expect(exercise.choices.map((choice) => choice.id)).toContain(
                        exercise.correctChoiceId,
                    );
                    expect(exercise.sentence.filter((part) => part === null)).toHaveLength(1);
                    break;
                case "dialogueChoice": {
                    const replies = dialogueReplies(lesson, exercise);
                    expect(replies).toHaveLength(exercise.distractors.length + 1);
                    expect(new Set(replies.map((reply) => reply.id)).size).toBe(replies.length);
                    break;
                }
                case "arrangeWords":
                case "listenArrangeWords":
                case "translateWordBank":
                    expect(phraseById(lesson, exercise.phraseId)).toBeDefined();
                    break;
            }
        }
    });

    it("offers tiles that can build every sentence, and keywords that are in it", () => {
        for (const exercise of lesson.exercises) {
            if (
                exercise.type !== "arrangeWords" &&
                exercise.type !== "listenArrangeWords" &&
                exercise.type !== "translateWordBank"
            ) {
                continue;
            }
            const sentence = phraseById(lesson, exercise.phraseId)!.text;
            const answer = correctAnswer(lesson, exercise);
            expect(answer.kind).toBe("tokens");
            if (answer.kind === "tokens") {
                expect(normalize(answer.tokens.join(" "))).toBe(normalize(sentence));
                if (exercise.type === "arrangeWords") {
                    // No decoys: the tiles are exactly the sentence.
                    expect([...exercise.tokens].sort()).toEqual([...answer.tokens].sort());
                }
            }
            if (exercise.grading.mode === "keywords") {
                const words = meaningfulWords(sentence).join(" ");
                exercise.grading.keywords.forEach((keyword) => {
                    expect(`${exercise.id}: ${words}`).toContain(
                        meaningfulWords(keyword).join(" "),
                    );
                });
            }
        }
    });

    it("grades its own right answers as correct", () => {
        for (const exercise of lesson.exercises) {
            const result = gradeAnswer(lesson, exercise, correctAnswer(lesson, exercise));
            expect(`${exercise.id}: ${result.correct}`).toBe(`${exercise.id}: true`);
        }
    });

    it("teaches every phrase it lists through at least one exercise", () => {
        const taught = new Set(
            lesson.exercises.flatMap((exercise: Exercise) =>
                "phraseId" in exercise ? [exercise.phraseId] : [],
            ),
        );
        lesson.phrases.forEach((phrase) => expect(taught).toContain(phrase.id));
    });

    it("keeps its speaking goals inside the English the lesson teaches", () => {
        const practice = lesson.speaking;
        if (!practice) return;
        const allowed = allowedEnglish(lesson);
        for (const goal of practice.goals) {
            const target =
                goal.phraseId !== undefined
                    ? phraseById(lesson, goal.phraseId)?.text
                    : vocabByIds(lesson, [goal.vocabId])[0]?.term;
            expect(target).toBeDefined();
            const words = meaningfulWords(target!).join(" ");
            goal.keywords.forEach((keyword) =>
                expect(`${goal.id}: ${words}`).toContain(meaningfulWords(keyword).join(" ")),
            );
            // The meaning is what the tutor asks with, so any English inside it
            // has to be English the lesson taught.
            const meaning =
                goal.phraseId !== undefined
                    ? phraseById(lesson, goal.phraseId)!.meaning
                    : vocabByIds(lesson, [goal.vocabId])[0].meaning;
            for (const language of LANGUAGES) {
                english(meaning[language] ?? "").forEach((word) =>
                    expect(`${goal.id}.${language}: ${word}`).toBe(
                        `${goal.id}.${language}: ${allowed.has(word.toLowerCase()) ? word : ""}`,
                    ),
                );
            }
        }
    });

    it("opens on recognition, not production", () => {
        const [first] = lesson.exercises;
        expect(["selectPicture", "matchPairs", "listenChooseMeaning"]).toContain(first.type);
    });
});
