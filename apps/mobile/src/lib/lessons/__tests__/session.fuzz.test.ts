import { FIRST_LANGUAGES, type FirstLanguage } from "@/lib/firstLanguage/languages";
import { LOCALES, type Locale } from "@/lib/i18n";
import { correctAnswer } from "@/test/lessonAnswers";

import { listLessons } from "../data";
import { dailyMix } from "../data/review";
import {
    appliesToLearner,
    fingerprint,
    initSession,
    isRevisit,
    restoreSession,
    reviewSession,
    sessionReducer,
    snapshotOf,
    summarize,
    type SessionState,
} from "../session";
import type { Answer, Exercise, Lesson } from "../types";

// Random walks through every real lesson (lib/lessons/session.ts), checking
// after each step what a learner relies on: there is always a way on, the bar
// never moves back, the mistake queue and the records stay sane, a saved run
// comes back where it was, a review changes nothing, and an exercise that
// finished itself on screen is never shown again as if it were waiting for an
// answer. That last one is the restart bug of October 2026 (the first exercise
// kept its matched pairs).
//
// 400 walks keep `npm test` quick; LESSON_FUZZ_RUNS=5000 for a deep run. A
// failure prints its seed: LESSON_FUZZ_SEED=<seed> replays it alone.

type Language = Locale | FirstLanguage;

/** Every language a run can be built for: the app's own and the learners' first. */
const LANGUAGES: readonly Language[] = [...new Set<Language>([...FIRST_LANGUAGES, ...LOCALES])];

/** Exercise types that hand in their own answer, with no Check. */
const SELF_GRADING = new Set<Exercise["type"]>(["matchPairs"]);

function rng(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** What a learner taps for a right answer, or something that is plainly wrong. */
function answerFor(lesson: Lesson, exercise: Exercise, right: boolean, slips: number): Answer {
    if (right) return correctAnswer(lesson, exercise);
    const answer = correctAnswer(lesson, exercise);
    switch (answer.kind) {
        case "pairs":
            // Matching is finished either way; a slip only spoils the first try.
            return { kind: "pairs", wrongAttempts: slips };
        case "choice":
            return { kind: "choice", choiceId: "not-an-option" };
        case "tokens":
            return { kind: "tokens", tokens: [...answer.tokens].reverse().concat("not-a-word") };
    }
}

function lessonsUnderTest(): Lesson[] {
    const days = Array.from({ length: 60 }, (_, day) => new Date(Date.UTC(2026, 9, 1 + day, 4)));
    return [...listLessons(), ...days.map((day) => dailyMix(listLessons(), day))];
}

type Walk = { lesson: Lesson; language: Language; screenReader: boolean; steps: string[] };

function check(walk: Walk, cond: unknown, message: string): asserts cond {
    if (!cond) {
        throw new Error(
            `${message}\n  lesson ${walk.lesson.id} (${walk.language}${walk.screenReader ? ", screen reader" : ""})\n  steps: ${walk.steps.join(" → ")}`,
        );
    }
}

/**
 * Everything that must hold in any state a learner can reach. A review opens a
 * finished lesson with every exercise counted as answered and records nothing.
 */
function checkState(walk: Walk, state: SessionState, reviewing: boolean) {
    const { queue, position, reached, phase, records, requeued } = state;
    check(
        walk,
        position >= 0 && position <= reached && reached <= queue.length,
        `position ${position} / reached ${reached} / queue ${queue.length}`,
    );
    check(
        walk,
        (phase === "finished") === position >= queue.length,
        `phase ${phase} at ${position} of ${queue.length}`,
    );
    if (phase === "graded") {
        check(walk, state.result !== null && state.draft !== null, "graded without a result");
    }
    if (phase === "answering") check(walk, state.result === null, "a result while answering");
    if (phase !== "finished") {
        // Something to show: an exercise that can't be found leaves a learner
        // on "This exercise could not be loaded" with no way on.
        const exercise = state.lesson.exercises.find((item) => item.id === queue[position]);
        check(walk, exercise !== undefined, `no exercise for ${queue[position]}`);
    }
    for (const id of new Set(queue)) {
        check(
            walk,
            queue.filter((item) => item === id).length <= 2,
            `${id} queued more than twice`,
        );
    }
    check(walk, new Set(requeued).size === requeued.length, "an exercise re-queued twice");
    for (const id of requeued)
        check(walk, queue.includes(id), `re-queued ${id} is not on the queue`);
    for (const [id, record] of Object.entries(records)) {
        check(walk, queue.includes(id), `a record for ${id}, which is not on the queue`);
        check(walk, record.attempts >= 1, `${id} recorded with no attempts`);
        if (record.firstTryCorrect) {
            check(walk, record.attempts === 1, `${id} first-try right after ${record.attempts}`);
        }
    }
    const summary = summarize(state);
    check(walk, summary.firstTryCorrect <= summary.total, "more first-try answers than exercises");
    if (phase === "finished" && !reviewing) {
        for (const id of queue) check(walk, records[id] !== undefined, `finished without ${id}`);
    }
}

describe("random walks through every lesson", () => {
    it("never strands a learner, rewinds the bar, or corrupts the run", () => {
        const lessons = lessonsUnderTest();
        const runs = Number(process.env.LESSON_FUZZ_RUNS ?? 400);
        const seeds =
            process.env.LESSON_FUZZ_SEED === undefined
                ? Array.from({ length: runs }, (_, run) => (0x5eed + run * 7919) >>> 0)
                : [Number(process.env.LESSON_FUZZ_SEED) >>> 0];
        const stats = {
            walks: 0,
            steps: 0,
            finished: 0,
            restarts: 0,
            restores: 0,
            revisits: 0,
            reviews: 0,
        };

        for (const seed of seeds) {
            const random = rng(seed);
            const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
            const lesson = pick(lessons);
            const language = pick(LANGUAGES);
            const screenReader = random() < 0.15;
            const walk: Walk = { lesson, language, screenReader, steps: [`seed ${seed}`] };

            // Exercise ids are how the session finds an exercise; a clash would
            // show the wrong one.
            const ids = lesson.exercises.map((exercise) => exercise.id);
            check(walk, new Set(ids).size === ids.length, "duplicate exercise ids");

            let state = initSession(lesson, language, screenReader);
            // The language the learner reads now; resuming can change it.
            let current: Language = language;
            // Stepping back through a finished lesson from its done view.
            let reviewing = false;
            // The screen's view of the exercise on show, as the lesson screen
            // keys it: `${round}-${position}-${id}`. `finishedItself` is a
            // self-grading exercise that has handed in its answer and has no
            // more to give.
            let round = 0;
            type Mounted = { key: string; finishedItself: boolean };
            let mounted = null as Mounted | null;
            let bar = 0;

            for (let step = 0; step < 120; step++) {
                checkState(walk, state, reviewing);
                if (reviewing) {
                    // A review records nothing and every exercise in it is answered.
                    check(walk, Object.keys(state.records).length === 0, "a review recorded");
                    check(walk, state.phase === "finished" || isRevisit(state), "a review asked");
                }
                const exercise = state.lesson.exercises.find(
                    (item) => item.id === state.queue[state.position],
                );
                const key =
                    state.phase === "finished" || !exercise
                        ? null
                        : `${round}-${state.position}-${exercise.id}`;
                if (key !== mounted?.key) mounted = key ? { key, finishedItself: false } : null;
                if (mounted?.finishedItself && state.phase === "answering") {
                    check(walk, false, "a self-graded exercise is back on screen, used up");
                }

                const progress = state.queue.length === 0 ? 1 : state.reached / state.queue.length;
                check(walk, progress >= bar - 1e-9, `the bar went back from ${bar} to ${progress}`);
                bar = progress;
                if (isRevisit(state)) stats.revisits++;

                const roll = random();
                let action: string;
                if (state.phase === "finished") {
                    if (reviewing) {
                        // The end of a review is the done view it started from.
                        reviewing = false;
                        action = "end review";
                    } else if (roll < 0.4 || state.queue.length === 0) {
                        stats.finished++;
                        break;
                    } else {
                        // The results: Practise again, Back into the last
                        // exercise, or (later, from the done view) a review.
                        action = roll < 0.6 ? "practise again" : roll < 0.8 ? "back" : "review";
                    }
                } else if (!reviewing && roll < 0.08 && state.reached > 0) {
                    action = "restart";
                } else if (!reviewing && roll < 0.14 && state.phase !== "graded") {
                    action = "save and resume";
                } else if (roll < 0.24) {
                    action = "back";
                } else if (state.phase === "graded" || (isRevisit(state) && roll < 0.4)) {
                    action = "next";
                } else {
                    action = roll < 0.75 ? "right" : "wrong";
                }
                walk.steps.push(`${action}@${state.position}`);
                stats.steps++;

                switch (action) {
                    case "right":
                    case "wrong": {
                        const answer = answerFor(
                            state.lesson,
                            exercise!,
                            action === "right",
                            1 + Math.floor(random() * 3),
                        );
                        if (SELF_GRADING.has(exercise!.type)) {
                            state = sessionReducer(state, { type: "submit", answer });
                            if (mounted) mounted.finishedItself = true;
                        } else {
                            state = sessionReducer(state, { type: "draft", answer });
                            state = sessionReducer(state, { type: "submit" });
                        }
                        check(walk, state.phase === "graded", `${action} answer did not grade`);
                        break;
                    }
                    case "next":
                        state = sessionReducer(state, { type: "next" });
                        break;
                    case "back":
                        state = sessionReducer(state, { type: "back" });
                        break;
                    case "restart":
                        // Restart lesson, from inside a run: the lesson screen's
                        // startOver, which also draws a new round.
                        state = sessionReducer(state, { type: "restart" });
                        round++;
                        bar = 0;
                        stats.restarts++;
                        check(
                            walk,
                            state.position === 0 && state.reached === 0,
                            "restart kept the place",
                        );
                        break;
                    case "practise again":
                        // From the results, which show no exercise.
                        state = sessionReducer(state, { type: "restart" });
                        mounted = null;
                        bar = 0;
                        break;
                    case "review": {
                        // Back from the done view into a finished lesson.
                        const before = summarize(state);
                        state = reviewSession(state.lesson, current, screenReader);
                        reviewing = true;
                        mounted = null;
                        bar = state.queue.length === 0 ? 1 : state.reached / state.queue.length;
                        stats.reviews++;
                        check(walk, before.total >= 0, "no summary before a review");
                        break;
                    }
                    case "end review":
                        // The done view again; a learner then practises or leaves.
                        state = initSession(state.lesson, current, screenReader);
                        mounted = null;
                        bar = 0;
                        break;
                    case "save and resume": {
                        // Leaving and coming back, maybe reading another language.
                        const snapshot = snapshotOf(state);
                        const reading = random() < 0.3 ? pick(LANGUAGES) : current;
                        const resumed = restoreSession(
                            state.lesson,
                            snapshot,
                            screenReader,
                            reading,
                        );
                        // Nothing saved yet, or every exercise answered: then the
                        // lesson is recorded as done and opens on its results.
                        if (snapshot.position === 0 || snapshot.position >= snapshot.queue.length) {
                            break;
                        }
                        if (resumed === null) {
                            const misfits = snapshot.queue.filter((id) => {
                                const item = state.lesson.exercises.find((one) => one.id === id);
                                return !item || !appliesToLearner(item, current, screenReader);
                            });
                            // A run that was saved can always be picked up again,
                            // in any language: finished, if nothing is left in it.
                            check(
                                walk,
                                false,
                                `a run in progress could not be picked up again (fingerprint ${snapshot.fingerprint === fingerprint(state.lesson) ? "same" : "changed"}, position ${snapshot.position} of ${snapshot.queue.length}, locale ${snapshot.locale}, misfits ${misfits.join(",") || "none"})`,
                            );
                            break;
                        }
                        check(
                            walk,
                            resumed.position === state.reached,
                            "resumed somewhere other than where the learner had got to",
                        );
                        check(
                            walk,
                            resumed.queue.slice(0, resumed.position).join() ===
                                state.queue.slice(0, state.reached).join(),
                            "resume rewrote answered exercises",
                        );
                        check(
                            walk,
                            JSON.stringify(resumed.records) === JSON.stringify(state.records),
                            "resume lost or changed a record",
                        );
                        state = resumed;
                        current = reading;
                        mounted = null;
                        bar =
                            resumed.queue.length === 0 ? 1 : resumed.reached / resumed.queue.length;
                        stats.restores++;
                        break;
                    }
                }
            }
            stats.walks++;
        }

        expect(stats.walks).toBe(seeds.length);
        expect(stats.finished).toBeGreaterThan(0);
        expect(stats.restarts).toBeGreaterThan(0);
        expect(stats.restores).toBeGreaterThan(0);
        expect(stats.revisits).toBeGreaterThan(0);
        expect(stats.reviews).toBeGreaterThan(0);
    });

    it("plays every lesson straight through in every language", () => {
        for (const lesson of listLessons()) {
            for (const language of LANGUAGES) {
                for (const screenReader of [false, true]) {
                    let state = initSession(lesson, language, screenReader);
                    for (let guard = 0; state.phase !== "finished" && guard < 50; guard++) {
                        const exercise = lesson.exercises.find(
                            (item) => item.id === state.queue[state.position],
                        )!;
                        state = sessionReducer(state, {
                            type: "submit",
                            answer: correctAnswer(lesson, exercise),
                        });
                        expect(state.result?.correct).toBe(true);
                        state = sessionReducer(state, { type: "next" });
                    }
                    expect(state.phase).toBe("finished");
                    expect(summarize(state)).toMatchObject({
                        total: state.queue.length,
                        firstTryCorrect: state.queue.length,
                        reviewed: 0,
                    });
                }
            }
        }
    });
});
