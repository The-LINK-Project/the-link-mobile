import { correctAnswer } from "@/test/lessonAnswers";

import { getLesson, listLessons } from "../data";
import { DAILY_MIX_ID, dailyMix } from "../data/review";
import { gradeAnswer } from "../grading";
import { initSession, sessionReducer } from "../session";

const lessons = listLessons();

describe("daily mix", () => {
    it("draws a short run from every lesson's exercises", () => {
        const mix = dailyMix(lessons, new Date(2026, 8, 15));
        expect(mix.exercises.length).toBeLessThanOrEqual(8);
        expect(mix.exercises.length).toBeGreaterThan(0);
        const all = new Set(lessons.flatMap((lesson) => lesson.exercises.map((e) => e.id)));
        mix.exercises.forEach((exercise) => expect(all).toContain(exercise.id));
    });

    it("is the same all day and different the next day", () => {
        const morning = dailyMix(lessons, new Date(2026, 8, 15, 7));
        const evening = dailyMix(lessons, new Date(2026, 8, 15, 22));
        const tomorrow = dailyMix(lessons, new Date(2026, 8, 16, 7));
        const ids = (lesson: { exercises: { id: string }[] }) => lesson.exercises.map((e) => e.id);
        expect(ids(morning)).toEqual(ids(evening));
        expect(ids(tomorrow)).not.toEqual(ids(morning));
    });

    it("carries every lesson's words, so each exercise can resolve its references", () => {
        const mix = dailyMix(lessons, new Date(2026, 8, 15));
        for (const exercise of mix.exercises) {
            const result = gradeAnswer(mix, exercise, correctAnswer(mix, exercise));
            expect(result.correct).toBe(true);
        }
    });

    it("plays through as a lesson", () => {
        const mix = getLesson(DAILY_MIX_ID)!;
        let state = initSession(mix, "bn");
        for (let guard = 0; guard < 20 && state.phase !== "finished"; guard++) {
            const exercise = mix.exercises.find((e) => e.id === state.queue[state.position])!;
            state = sessionReducer(state, {
                type: "submit",
                answer: correctAnswer(mix, exercise),
            });
            state = sessionReducer(state, { type: "next" });
        }
        expect(state.phase).toBe("finished");
    });

    it("hands out one object per day, so screens keyed on identity stay stable", () => {
        expect(dailyMix(lessons)).toBe(dailyMix(lessons));
        expect(getLesson(DAILY_MIX_ID)).toBe(getLesson(DAILY_MIX_ID));
    });
});
