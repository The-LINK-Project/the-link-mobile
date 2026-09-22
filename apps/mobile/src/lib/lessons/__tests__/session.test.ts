import { correctAnswer } from "@/test/lessonAnswers";

import { mrtBasics } from "../data/mrt-basics";
import { buildQueue, initSession, sessionReducer, summarize } from "../session";
import type { Answer, Exercise, Lesson } from "../types";

/** The right answer for an exercise in the MRT lesson, by id. */
function correctFor(id: string): Answer {
    const exercise = mrtBasics.exercises.find((item) => item.id === id);
    if (!exercise) throw new Error(`No exercise ${id}`);
    return correctAnswer(mrtBasics, exercise);
}

const WRONG: Answer = { kind: "choice", choiceId: "definitely-wrong" };

type State = ReturnType<typeof initSession>;

/** Answer the current exercise and move to the next one. */
function answerAndAdvance(state: State, answer: Answer): State {
    expect(answer).toBeDefined();
    const submitted = sessionReducer(state, { type: "submit", answer });
    expect(submitted.phase).toBe("graded");
    return sessionReducer(submitted, { type: "next" });
}

/** The right answer for whatever is currently on screen. */
function correctAt(state: State): Answer {
    const id = state.queue[state.position];
    const exercise = state.lesson.exercises.find((item) => item.id === id);
    if (!exercise) throw new Error(`No exercise ${id}`);
    return correctAnswer(state.lesson, exercise);
}

/** Answer whatever is on screen correctly. */
function answerCorrectly(state: State): State {
    return answerAndAdvance(state, correctAt(state));
}

/** Walk forward until the named exercise is the one on screen. */
function at(id: string): State {
    return until(
        initSession(mrtBasics, LEARNER),
        (state) => state.queue[state.position] === id,
        answerCorrectly,
    );
}

/**
 * Run a loop that is expected to reach a condition, failing fast instead of
 * hanging if the session ever stops making progress.
 */
function until(state: State, done: (state: State) => boolean, step: (state: State) => State) {
    let current = state;
    for (let guard = 0; guard < 50; guard++) {
        if (done(current)) return current;
        current = step(current);
    }
    throw new Error("session did not reach the expected state");
}

/**
 * Bengali rather than English for the default run: every exercise applies, so a
 * test about session flow is not silently exercising a shorter lesson. English
 * learners skip the translation exercise, which has its own tests.
 */
const LEARNER = "bn" as const;

function playPerfectly(lesson: Lesson) {
    return until(
        initSession(lesson, LEARNER),
        (state) => state.phase === "finished",
        answerCorrectly,
    );
}

/**
 * Advance to an exercise that can actually be failed.
 *
 * Matching grades as passed once every pair is placed — a wrong pair is
 * rejected in the moment rather than failing the exercise — so the mistake
 * paths have to be exercised on a different type.
 */
function atFailableExercise(): State {
    return until(
        initSession(mrtBasics, LEARNER),
        (state) => state.queue[state.position] !== "ex-1-pairs",
        answerCorrectly,
    );
}

describe("buildQueue", () => {
    it("keeps every applicable exercise exactly once", () => {
        const queue = buildQueue(mrtBasics.exercises, "bn");
        expect(queue).toHaveLength(mrtBasics.exercises.length);
        expect(new Set(queue).size).toBe(queue.length);
    });

    it("leaves out translation for a learner already reading in English", () => {
        // The prompt would fall back to English, asking the learner to build a
        // sentence that is already on screen above the tiles.
        const queue = buildQueue(mrtBasics.exercises, "en");
        expect(queue).not.toContain("ex-4-translate");
        expect(queue).toHaveLength(mrtBasics.exercises.length - 1);
    });

    it("leaves out picture exercises when a screen reader is running", () => {
        // The tiles deliberately do not name themselves, so a label would read
        // the answer aloud. An exercise that can only be guessed at is worse
        // than one that is not offered.
        const queue = buildQueue(mrtBasics.exercises, LEARNER, true);
        expect(queue).not.toContain("ex-0-picture");
        // The reverse exercise shows a picture as the prompt, so the same applies.
        expect(queue).not.toContain("ex-2b-picture-word");
        expect(buildQueue(mrtBasics.exercises, LEARNER, false)).toContain("ex-0-picture");
    });

    it("leaves out translation for a language the prompt has no words in", () => {
        // Every first language has this prompt now, so make one that none has.
        const exercises = mrtBasics.exercises.map((exercise) =>
            exercise.id === "ex-4-translate" && exercise.type === "translateWordBank"
                ? { ...exercise, prompt: { en: "Which way is out?" } }
                : exercise,
        );
        expect(buildQueue(exercises, "bu")).not.toContain("ex-4-translate");
        expect(buildQueue(mrtBasics.exercises, "bu")).toContain("ex-4-translate");
    });

    it("avoids showing the same exercise type twice in a row", () => {
        const repeated = [
            { id: "a", type: "fillBlank" },
            { id: "b", type: "fillBlank" },
            { id: "c", type: "arrangeWords" },
        ] as unknown as Exercise[];

        expect(buildQueue(repeated, "en")).toEqual(["a", "c", "b"]);
    });

    it("falls back to authored order when every exercise shares a type", () => {
        const sameType = [
            { id: "a", type: "fillBlank" },
            { id: "b", type: "fillBlank" },
        ] as unknown as Exercise[];

        expect(buildQueue(sameType, "en")).toEqual(["a", "b"]);
    });
});

describe("session flow", () => {
    it("starts on the first exercise, answering", () => {
        const state = initSession(mrtBasics, LEARNER);
        expect(state.phase).toBe("answering");
        expect(state.position).toBe(0);
        expect(state.draft).toBeNull();
    });

    it("finishes immediately for a lesson with no exercises", () => {
        expect(initSession({ ...mrtBasics, exercises: [] }, LEARNER).phase).toBe("finished");
    });

    it("finishes immediately when no exercise applies to the learner", () => {
        const onlyTranslation = {
            ...mrtBasics,
            exercises: mrtBasics.exercises.filter((e) => e.type === "translateWordBank"),
        };
        expect(initSession(onlyTranslation, "en").phase).toBe("finished");
    });

    it("reports progress against the exercises the learner will actually see", () => {
        const english = initSession(mrtBasics, "en");
        expect(english.queue).toHaveLength(mrtBasics.exercises.length - 1);
        expect(summarize(english).total).toBe(mrtBasics.exercises.length - 1);
    });

    it("holds the graded result until the learner continues", () => {
        const start = initSession(mrtBasics, LEARNER);
        const state = sessionReducer(start, { type: "submit", answer: correctAt(start) });
        expect(state.phase).toBe("graded");
        expect(state.result?.correct).toBe(true);
        // Position must not move while the feedback footer is still up.
        expect(state.position).toBe(0);
    });

    it("ignores a draft change once the answer has been graded", () => {
        const start = initSession(mrtBasics, LEARNER);
        const graded = sessionReducer(start, { type: "submit", answer: correctAt(start) });
        expect(sessionReducer(graded, { type: "draft", answer: WRONG })).toBe(graded);
    });

    it("grades the draft when submit carries no answer", () => {
        // How the Check button submits: the draft is the answer.
        let state = atFailableExercise();
        state = sessionReducer(state, {
            type: "draft",
            answer: correctFor(state.queue[state.position]),
        });
        state = sessionReducer(state, { type: "submit" });

        expect(state.phase).toBe("graded");
        expect(state.result?.correct).toBe(true);
    });

    it("ignores a press event handed in where an answer belongs", () => {
        // Regression: wiring `submit` straight to onPress passed the press
        // event as the answer, which graded every exercise as wrong no matter
        // what the learner had chosen.
        const start = atFailableExercise();
        const intended = correctFor(start.queue[start.position]);
        let state = sessionReducer(start, { type: "draft", answer: intended });

        const pressEvent = { nativeEvent: { pageX: 1, pageY: 2 }, target: 7 };
        state = sessionReducer(state, {
            type: "submit",
            answer: pressEvent as unknown as Answer,
        });

        expect(state.phase).toBe("graded");
        expect(state.result?.correct).toBe(true);
        // The event must never replace the learner's answer.
        expect(state.draft).toEqual(intended);
    });

    it("ignores a submit with no answer", () => {
        const state = initSession(mrtBasics, LEARNER);
        expect(sessionReducer(state, { type: "submit" })).toBe(state);
    });

    it("reaches the end after answering every exercise correctly", () => {
        const state = playPerfectly(mrtBasics);
        expect(state.position).toBe(mrtBasics.exercises.length);
        expect(state.queue).toHaveLength(mrtBasics.exercises.length);
    });
});

describe("mistakes", () => {
    it("re-queues a missed exercise at the end instead of blocking", () => {
        const before = atFailableExercise();
        const missed = before.queue[before.position];
        const wrong = sessionReducer(before, { type: "submit", answer: WRONG });

        expect(wrong.result?.correct).toBe(false);
        expect(wrong.queue).toHaveLength(before.queue.length + 1);
        expect(wrong.queue[wrong.queue.length - 1]).toBe(missed);
        // Progress is not rewound: the learner stays where they are.
        expect(wrong.position).toBe(before.position);
    });

    it("re-queues the same exercise only once, so it cannot loop forever", () => {
        const start = atFailableExercise();
        const target = start.queue[start.position];

        let state = answerAndAdvance(start, WRONG);
        const lengthAfterFirstMiss = state.queue.length;

        // Walk to the re-queued copy and miss it a second time.
        state = until(state, (s) => s.queue[s.position] === target, answerCorrectly);
        state = sessionReducer(state, { type: "submit", answer: WRONG });

        expect(state.queue).toHaveLength(lengthAfterFirstMiss);
    });

    it("counts an exercise as done while its feedback is still on screen", () => {
        const start = atFailableExercise();
        const before = start.position / start.queue.length;
        const graded = sessionReducer(start, { type: "submit", answer: correctAt(start) });

        expect((graded.position + 1) / graded.queue.length).toBeGreaterThan(before);
    });

    it("never lets progress move backwards", () => {
        let state = atFailableExercise();
        const missAt = state.position;
        let previous = state.position / state.queue.length;

        state = until(
            state,
            (s) => s.phase === "finished",
            (s) => {
                const next = answerAndAdvance(
                    s,
                    s.position === missAt ? WRONG : correctFor(s.queue[s.position]),
                );
                const progress = next.position / next.queue.length;
                expect(progress).toBeGreaterThanOrEqual(previous);
                previous = progress;
                return next;
            },
        );

        expect(state.phase).toBe("finished");
    });
});

describe("summarize", () => {
    it("counts a clean run as all first-try correct", () => {
        const summary = summarize(playPerfectly(mrtBasics));
        expect(summary.total).toBe(mrtBasics.exercises.length);
        expect(summary.firstTryCorrect).toBe(mrtBasics.exercises.length);
        expect(summary.reviewed).toBe(0);
    });

    it("does not credit a first-try pass to an exercise that was missed", () => {
        let state = atFailableExercise();
        const target = state.queue[state.position];

        state = answerAndAdvance(state, WRONG);
        state = until(state, (s) => s.phase === "finished", answerCorrectly);

        const summary = summarize(state);
        expect(state.records[target].firstTryCorrect).toBe(false);
        expect(summary.reviewed).toBe(1);
        expect(summary.firstTryCorrect).toBe(mrtBasics.exercises.length - 1);
    });

    it("does not count a matching run with a wrong pairing as right first time", () => {
        // The exercise still passes; it just was not clean.
        const messy = sessionReducer(at("ex-1-pairs"), {
            type: "submit",
            answer: { kind: "pairs", wrongAttempts: 1 },
        });

        expect(messy.result?.correct).toBe(true);
        expect(messy.records["ex-1-pairs"].firstTryCorrect).toBe(false);
        // Everything before it was answered cleanly, so only matching is missing.
        expect(summarize(messy).firstTryCorrect).toBe(messy.position);
    });

    it("lists the vocabulary the run practised", () => {
        const summary = summarize(playPerfectly(mrtBasics));
        expect(summary.practisedTerms).toContain("top up");
        expect(summary.practisedTerms).toContain("platform");
    });

    it("credits nothing before the learner has answered anything", () => {
        // A summary taken mid-lesson must not claim words from exercises still
        // ahead of the learner.
        const summary = summarize(initSession(mrtBasics, LEARNER));
        expect(summary.practisedTerms).toEqual([]);
        expect(summary.phrases).toEqual([]);
    });

    it("promises only the sentences the run actually built", () => {
        const bengali = summarize(playPerfectly(mrtBasics));
        expect(bengali.phrases.map((phrase) => phrase.id)).toEqual([
            "p-which-platform",
            "p-top-up-ten",
            "p-card-cannot-tap",
            "p-alight-here",
        ]);

        // English skips the translation exercise, so its sentence is not taught
        // and must not be promised at the end.
        const english = until(
            initSession(mrtBasics, "en"),
            (state) => state.phase === "finished",
            answerCorrectly,
        );
        expect(summarize(english).phrases.map((phrase) => phrase.id)).toEqual([
            "p-top-up-ten",
            "p-card-cannot-tap",
            "p-alight-here",
        ]);
    });
});

describe("restart", () => {
    it("clears results and returns to the first exercise", () => {
        const finished = playPerfectly(mrtBasics);
        const restarted = sessionReducer(finished, { type: "restart" });

        expect(restarted.phase).toBe("answering");
        expect(restarted.position).toBe(0);
        expect(restarted.records).toEqual({});
        expect(restarted.requeued).toEqual([]);
    });
});

describe("picking a run back up", () => {
    const { fingerprint, restoreSession, snapshotOf } = jest.requireActual("../session");

    it("returns to the exercise the learner was on, with their results intact", () => {
        let state = initSession(mrtBasics, "en");
        state = answerAndAdvance(state, WRONG);
        state = answerCorrectly(state);

        const restored = restoreSession(mrtBasics, snapshotOf(state), false);
        expect(restored).toMatchObject({
            position: 2,
            phase: "answering",
            draft: null,
            queue: state.queue,
            requeued: state.requeued,
            records: state.records,
        });
        // The missed exercise still comes round again at the end.
        expect(restored.queue[restored.queue.length - 1]).toBe(state.queue[0]);
    });

    it("moves past an exercise whose feedback was on screen, since it is already recorded", () => {
        const state = initSession(mrtBasics, "en");
        const graded = sessionReducer(state, { type: "submit", answer: correctAt(state) });
        expect(graded.phase).toBe("graded");

        const restored = restoreSession(mrtBasics, snapshotOf(graded), false);
        expect(restored.position).toBe(1);
        expect(restored.records[state.queue[0]].attempts).toBe(1);
    });

    it("refuses a run that no longer fits", () => {
        const state = answerCorrectly(initSession(mrtBasics, "en"));
        const saved = snapshotOf(state);

        const edited: Lesson = { ...mrtBasics, exercises: mrtBasics.exercises.slice(1) };
        expect(fingerprint(edited)).not.toBe(fingerprint(mrtBasics));
        expect(restoreSession(edited, saved, false)).toBeNull();
        // A screen reader switched on since: the queue holds picture exercises.
        expect(restoreSession(mrtBasics, saved, true)).toBeNull();
        expect(restoreSession(mrtBasics, { ...saved, locale: "xx" }, false)).toBeNull();
        expect(
            restoreSession(mrtBasics, { ...saved, position: saved.queue.length }, false),
        ).toBeNull();
        expect(
            restoreSession(mrtBasics, { ...saved, queue: [...saved.queue, "ex-unknown"] }, false),
        ).toBeNull();
    });

    const translations = mrtBasics.exercises
        .filter((exercise) => exercise.type === "translateWordBank")
        .map((exercise) => exercise.id);

    it("keeps the learner's place when they change language, and drops what no longer fits", () => {
        // Built for Bengali, so the translation exercises are in the queue.
        const state = answerCorrectly(initSession(mrtBasics, "bn"));
        expect(translations.length).toBeGreaterThan(0);
        expect(state.queue).toEqual(expect.arrayContaining(translations));

        // Back in English, a translation prompt would fall back to English and
        // ask for the sentence already on screen.
        const restored = restoreSession(mrtBasics, snapshotOf(state), false, "en");
        expect(restored).toMatchObject({ locale: "en", position: 1, records: state.records });
        expect(restored.queue[0]).toBe(state.queue[0]);
        expect(restored.queue.filter((id: string) => translations.includes(id))).toEqual([]);
        expect(restored.queue).toEqual(state.queue.filter((id) => !translations.includes(id)));
    });

    it("adds what has become possible in the new language, after what was already queued", () => {
        const state = answerCorrectly(initSession(mrtBasics, "en"));
        const restored = restoreSession(mrtBasics, snapshotOf(state), false, "bn");
        expect(restored.queue.slice(0, state.queue.length)).toEqual(state.queue);
        expect(restored.queue.slice(state.queue.length).sort()).toEqual([...translations].sort());
    });

    it("scores a run out of what was queued, so a language change cannot break the total", () => {
        let state = initSession(mrtBasics, "bn");
        state = until(state, (s) => s.phase === "finished", answerCorrectly);
        // Read back as an English run, fewer exercises would "apply" than were
        // answered, and a score of 9 out of 7 was thrown away by the progress
        // reader as corrupt, taking the finished lesson with it.
        const summary = summarize({ ...state, locale: "en" });
        expect(summary.total).toBe(state.queue.length);
        expect(summary.firstTryCorrect).toBeLessThanOrEqual(summary.total);
    });
});
