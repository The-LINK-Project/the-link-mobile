/**
 * Lesson session state.
 *
 * One reducer owns the whole run: which exercise is on screen, the draft
 * answer, the grade, and the mistake queue. Screens and exercise components
 * hold no session state of their own, so the flow stays testable without
 * rendering anything.
 *
 * Design decisions worth knowing:
 * - There are no hearts or energy. A wrong answer never blocks progress; the
 *   exercise is put back on the end of the queue instead. That is Duolingo's
 *   own spaced-repetition reasoning, minus the part that locks people out.
 * - Progress never moves backwards. The bar is `position / queue.length`, and
 *   the queue only ever grows, so a mistake slows the bar rather than undoing it.
 * - Nothing is persisted. Quitting a lesson discards the run, and the next start
 *   is a fresh one. Resuming a half-finished lesson needs a decision about where
 *   that state lives (device or server) and what happens when a lesson's content
 *   changes underneath a saved position, so it waits for the real data model
 *   rather than being guessed at here.
 */

import { useCallback, useMemo, useReducer } from "react";

import { gradeAnswer } from "./grading";
import type { Answer, Exercise, GradeResult, Lesson } from "./types";

/** Per-exercise outcome, keyed by exercise id. */
export type ExerciseRecord = {
    attempts: number;
    /** True when the learner got it right without ever getting it wrong. */
    firstTryCorrect: boolean;
};

export type SessionPhase = "answering" | "graded" | "finished";

export type SessionState = {
    lesson: Lesson;
    /** Exercise ids in the order they will be shown. Grows when a mistake is re-queued. */
    queue: string[];
    position: number;
    phase: SessionPhase;
    /** The answer in progress, before the learner submits it. */
    draft: Answer | null;
    /** The grade for the submitted answer, while the feedback footer is up. */
    result: GradeResult | null;
    records: Record<string, ExerciseRecord>;
    /** Ids already put back on the queue, so one item cannot loop forever. */
    requeued: string[];
};

/**
 * Is this a real answer?
 *
 * Guards the one place a value from outside can reach the grader. A React press
 * handler passes its event as the first argument, and an event graded as an
 * answer silently fails every exercise — which is exactly what happened when
 * the Check button was wired straight to `submit`. Cheap to check, and the
 * failure it prevents is invisible rather than loud.
 */
function isAnswer(value: unknown): value is Answer {
    if (typeof value !== "object" || value === null) return false;
    const kind = (value as { kind?: unknown }).kind;
    return kind === "choice" || kind === "tokens" || kind === "pairs";
}

type SessionAction =
    | { type: "draft"; answer: Answer | null }
    | { type: "submit"; answer?: Answer }
    | { type: "next" }
    | { type: "restart" };

/**
 * Order the exercises for one run.
 *
 * Keeps the authored order, but avoids showing the same exercise type twice in
 * a row where another type is available. That is all it does — it is not a cap
 * on how often a type may appear in total. Duolingo limits repeats after
 * learners complained about repetitive runs of one type; a real limit only
 * becomes worth building once lessons are generated rather than hand-written,
 * and this is deliberately the cheap version until then.
 */
export function buildQueue(exercises: Exercise[]): string[] {
    const remaining = [...exercises];
    const ordered: Exercise[] = [];

    while (remaining.length > 0) {
        const previousType = ordered[ordered.length - 1]?.type;
        const index = remaining.findIndex((exercise) => exercise.type !== previousType);
        // Every remaining exercise is the same type as the last one placed; there
        // is nothing to interleave, so keep the authored order.
        ordered.push(...remaining.splice(index === -1 ? 0 : index, 1));
    }

    return ordered.map((exercise) => exercise.id);
}

export function initSession(lesson: Lesson): SessionState {
    return {
        lesson,
        queue: buildQueue(lesson.exercises),
        position: 0,
        phase: lesson.exercises.length === 0 ? "finished" : "answering",
        draft: null,
        result: null,
        records: {},
        requeued: [],
    };
}

function exerciseById(lesson: Lesson, id: string | undefined): Exercise | undefined {
    return lesson.exercises.find((exercise) => exercise.id === id);
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
    switch (action.type) {
        case "draft":
            if (state.phase !== "answering") return state;
            return { ...state, draft: action.answer };

        case "submit": {
            if (state.phase !== "answering") return state;
            // A submitted answer wins over the draft, but only if it really is
            // an answer; otherwise fall back to what the learner built.
            const answer = isAnswer(action.answer) ? action.answer : state.draft;
            const exercise = exerciseById(state.lesson, state.queue[state.position]);
            if (!answer || !exercise) return state;

            const result = gradeAnswer(exercise, answer);
            const previous = state.records[exercise.id];
            const attempts = (previous?.attempts ?? 0) + 1;

            return {
                ...state,
                phase: "graded",
                draft: answer,
                result,
                records: {
                    ...state.records,
                    [exercise.id]: {
                        attempts,
                        // Only a clean first attempt counts. An existing record
                        // means this is a retry, and `firstPassClean: false`
                        // means the exercise passed but not cleanly — a matching
                        // run with a wrong pairing in it.
                        firstTryCorrect:
                            result.correct && !previous && result.firstPassClean !== false,
                    },
                },
                // Re-queue a missed exercise once, at the end, so it comes back after
                // some distance rather than immediately.
                queue:
                    result.correct || state.requeued.includes(exercise.id)
                        ? state.queue
                        : [...state.queue, exercise.id],
                requeued:
                    result.correct || state.requeued.includes(exercise.id)
                        ? state.requeued
                        : [...state.requeued, exercise.id],
            };
        }

        case "next": {
            if (state.phase !== "graded") return state;
            const position = state.position + 1;
            return {
                ...state,
                position,
                phase: position >= state.queue.length ? "finished" : "answering",
                draft: null,
                result: null,
            };
        }

        case "restart":
            return initSession(state.lesson);
    }
}

export type SessionSummary = {
    /** Distinct exercises in the lesson, ignoring re-queued repeats. */
    total: number;
    /** How many were right the first time they were seen. */
    firstTryCorrect: number;
    /** Exercises that needed a second look. */
    reviewed: number;
    /** Vocabulary terms this run practised. */
    practisedTerms: string[];
};

export function summarize(state: SessionState): SessionSummary {
    const total = state.lesson.exercises.length;
    const records = Object.values(state.records);
    const firstTryCorrect = records.filter((record) => record.firstTryCorrect).length;

    const practisedIds = new Set(state.lesson.exercises.flatMap((exercise) => exercise.practises));
    const practisedTerms = state.lesson.vocab
        .filter((item) => practisedIds.has(item.id))
        .map((item) => item.term);

    return { total, firstTryCorrect, reviewed: state.requeued.length, practisedTerms };
}

/** Session state plus the handlers a screen needs. */
export function useLessonSession(lesson: Lesson) {
    const [state, dispatch] = useReducer(sessionReducer, lesson, initSession);

    const exercise = useMemo(
        () => exerciseById(state.lesson, state.queue[state.position]),
        [state.lesson, state.queue, state.position],
    );

    return {
        state,
        exercise,
        /** 0 to 1, for the progress bar. Never decreases within a run. */
        progress: state.queue.length === 0 ? 1 : state.position / state.queue.length,
        isLastStep: state.position === state.queue.length - 1,
        setDraft: useCallback((answer: Answer | null) => dispatch({ type: "draft", answer }), []),
        /**
         * Grade whatever the learner has built. Takes no arguments on purpose:
         * it is wired to a press handler, and an optional first parameter would
         * quietly receive the press event instead.
         */
        submit: useCallback(() => dispatch({ type: "submit" }), []),
        /** Grade an answer handed over by a self-grading exercise such as matching. */
        submitAnswer: useCallback((answer: Answer) => dispatch({ type: "submit", answer }), []),
        next: useCallback(() => dispatch({ type: "next" }), []),
        restart: useCallback(() => dispatch({ type: "restart" }), []),
        summary: useMemo(() => summarize(state), [state]),
    };
}
