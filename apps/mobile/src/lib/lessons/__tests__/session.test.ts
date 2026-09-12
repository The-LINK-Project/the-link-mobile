import { mrtBasics } from "../data/mrt-basics";
import { buildQueue, initSession, sessionReducer, summarize } from "../session";
import type { Answer, Exercise, Lesson } from "../types";

const correctFor: Record<string, Answer> = {
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

/** Answer whatever is on screen correctly. */
function answerCorrectly(state: State): State {
    return answerAndAdvance(state, correctFor[state.queue[state.position]]);
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

function playPerfectly(lesson: Lesson) {
    return until(initSession(lesson), (state) => state.phase === "finished", answerCorrectly);
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
        initSession(mrtBasics),
        (state) => state.queue[state.position] !== "ex-1-pairs",
        answerCorrectly,
    );
}

describe("buildQueue", () => {
    it("keeps every exercise exactly once", () => {
        const queue = buildQueue(mrtBasics.exercises);
        expect(queue).toHaveLength(mrtBasics.exercises.length);
        expect(new Set(queue).size).toBe(queue.length);
    });

    it("avoids showing the same exercise type twice in a row", () => {
        const repeated = [
            { id: "a", type: "fillBlank" },
            { id: "b", type: "fillBlank" },
            { id: "c", type: "arrangeWords" },
        ] as unknown as Exercise[];

        expect(buildQueue(repeated)).toEqual(["a", "c", "b"]);
    });

    it("falls back to authored order when every exercise shares a type", () => {
        const sameType = [
            { id: "a", type: "fillBlank" },
            { id: "b", type: "fillBlank" },
        ] as unknown as Exercise[];

        expect(buildQueue(sameType)).toEqual(["a", "b"]);
    });
});

describe("session flow", () => {
    it("starts on the first exercise, answering", () => {
        const state = initSession(mrtBasics);
        expect(state.phase).toBe("answering");
        expect(state.position).toBe(0);
        expect(state.draft).toBeNull();
    });

    it("finishes immediately for a lesson with no exercises", () => {
        expect(initSession({ ...mrtBasics, exercises: [] }).phase).toBe("finished");
    });

    it("holds the graded result until the learner continues", () => {
        const state = sessionReducer(initSession(mrtBasics), {
            type: "submit",
            answer: correctFor["ex-1-pairs"],
        });
        expect(state.phase).toBe("graded");
        expect(state.result?.correct).toBe(true);
        // Position must not move while the feedback footer is still up.
        expect(state.position).toBe(0);
    });

    it("ignores a draft change once the answer has been graded", () => {
        const graded = sessionReducer(initSession(mrtBasics), {
            type: "submit",
            answer: correctFor["ex-1-pairs"],
        });
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
        const state = initSession(mrtBasics);
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

    it("lists the vocabulary the lesson practises", () => {
        const summary = summarize(initSession(mrtBasics));
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
