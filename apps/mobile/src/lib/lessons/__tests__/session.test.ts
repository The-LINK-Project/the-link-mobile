import { mrtBasics } from "../data/mrt-basics";
import { buildQueue, initSession, sessionReducer, summarize } from "../session";
import type { Answer, Exercise, Lesson } from "../types";

const correctFor: Record<string, Answer> = {
    "ex-0-picture": { kind: "choice", choiceId: "v-platform" },
    "ex-1-pairs": { kind: "pairs", wrongAttempts: 0 },
    "ex-2-listen": { kind: "choice", choiceId: "c-correct" },
    "ex-3-arrange": { kind: "tokens", tokens: ["I", "want", "to", "top up", "ten", "dollars"] },
    "ex-4-translate": { kind: "tokens", tokens: ["Which", "platform", "for", "Jurong East"] },
    "ex-5-fill": { kind: "choice", choiceId: "f-out" },
};

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
    return correctFor[state.queue[state.position]];
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

    it("leaves out translation for a language the prompt has no words in", () => {
        // Burmese ships as an app language but has no lesson content yet.
        expect(buildQueue(mrtBasics.exercises, "bu")).not.toContain("ex-4-translate");
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
            answer: correctFor[state.queue[state.position]],
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
        const intended = correctFor[start.queue[start.position]];
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
                    s.position === missAt ? WRONG : correctFor[s.queue[s.position]],
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

    it("lists the vocabulary the lesson practises", () => {
        const summary = summarize(initSession(mrtBasics, LEARNER));
        expect(summary.practisedTerms).toContain("top up");
        expect(summary.practisedTerms).toContain("platform");
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
