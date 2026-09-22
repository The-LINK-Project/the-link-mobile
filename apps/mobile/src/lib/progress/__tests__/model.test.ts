import {
    continuePoint,
    doneToday,
    emptyData,
    lessonStage,
    lessonStatus,
    mergeProgress,
    readData,
    readProgress,
    withLessonDone,
    withSpeakingDone,
    type ProgressData,
    type SavedRun,
} from "../model";

const at = (iso: string) => new Date(iso);

function run(overrides: Partial<SavedRun> = {}): SavedRun {
    return {
        fingerprint: "f",
        locale: "en",
        screenReader: false,
        queue: ["a", "b", "c", "d"],
        position: 2,
        records: { a: { attempts: 1, firstTryCorrect: true } },
        requeued: [],
        savedAt: "2026-09-17T10:00:00.000Z",
        ...overrides,
    };
}

describe("finishing a lesson", () => {
    it("counts every finish and keeps the best result, not the latest", () => {
        let progress = withLessonDone(
            { lessons: {} },
            "mrt-basics",
            { firstTryCorrect: 8, total: 9 },
            at("2026-09-10T10:00:00Z"),
        );
        progress = withLessonDone(
            progress,
            "mrt-basics",
            { firstTryCorrect: 5, total: 9 },
            at("2026-09-12T10:00:00Z"),
        );
        expect(progress.lessons["mrt-basics"]).toEqual({
            completedAt: "2026-09-12T10:00:00.000Z",
            runs: 2,
            bestFirstTry: 8,
            total: 9,
        });
    });

    it("keeps the speaking result when the exercises are done again", () => {
        let progress = withLessonDone({ lessons: {} }, "mrt-basics", {
            firstTryCorrect: 9,
            total: 9,
        });
        progress = withSpeakingDone(progress, "mrt-basics", { said: 3, total: 4 });
        progress = withLessonDone(progress, "mrt-basics", { firstTryCorrect: 2, total: 9 });
        expect(progress.lessons["mrt-basics"].speaking).toMatchObject({ said: 3, total: 4 });
    });

    it("records speaking even with no exercises on record", () => {
        const progress = withSpeakingDone({ lessons: {} }, "mrt-basics", { said: 1, total: 4 });
        expect(progress.lessons["mrt-basics"].speaking).toMatchObject({ said: 1, total: 4 });
    });
});

describe("merging the phone's copy with the server's", () => {
    it("gives the same answer in either order and loses nothing", () => {
        const phone = withLessonDone({ lessons: {} }, "a", { firstTryCorrect: 3, total: 9 });
        const server = withSpeakingDone(
            withLessonDone({ lessons: {} }, "a", { firstTryCorrect: 7, total: 9 }),
            "a",
            { said: 2, total: 4 },
        );
        server.lessons.b = {
            completedAt: "2026-01-01T00:00:00.000Z",
            runs: 4,
            bestFirstTry: 1,
            total: 8,
        };

        const merged = mergeProgress(phone, server);
        expect(merged).toEqual(mergeProgress(server, phone));
        expect(merged.lessons.a.bestFirstTry).toBe(7);
        expect(merged.lessons.a.speaking).toMatchObject({ said: 2 });
        expect(merged.lessons.b.runs).toBe(4);
    });

    it("settles two equally good results the same way from either side", () => {
        const stamp = "2026-01-01T00:00:00.000Z";
        const lesson = (bestFirstTry: number, total: number, said: number, of: number) => ({
            lessons: {
                a: {
                    completedAt: stamp,
                    runs: 1,
                    bestFirstTry,
                    total,
                    speaking: { completedAt: stamp, said, total: of },
                },
            },
        });
        // Half right both times, but out of different totals. Without a rule for
        // the tie each side kept its own copy, and they swapped on every sync.
        const phone = lesson(3, 6, 1, 2);
        const server = lesson(4, 8, 2, 4);
        const merged = mergeProgress(phone, server);
        expect(merged).toEqual(mergeProgress(server, phone));
        expect(merged.lessons.a).toMatchObject({ bestFirstTry: 4, total: 8 });
        expect(merged.lessons.a.speaking).toMatchObject({ said: 2, total: 4 });
    });
});

describe("reading what was stored", () => {
    it("drops what does not look right and keeps the rest", () => {
        const good = {
            completedAt: "2026-09-10T10:00:00.000Z",
            runs: 1,
            bestFirstTry: 2,
            total: 9,
        };
        const progress = readProgress({
            lessons: {
                "mrt-basics": good,
                "Bad Id": good,
                "too-good": { ...good, bestFirstTry: 10 },
                "no-date": { ...good, completedAt: "soon" },
                "bad-speaking": { ...good, speaking: { completedAt: "x", said: 1, total: 1 } },
            },
        });
        expect(Object.keys(progress.lessons).sort()).toEqual(["bad-speaking", "mrt-basics"]);
        expect(progress.lessons["bad-speaking"].speaking).toBeUndefined();
        expect(readProgress("nonsense")).toEqual({ lessons: {} });
    });

    it("forgets a run after two weeks and the reopen point after half an hour", () => {
        const stored = {
            version: 1,
            progress: { lessons: {} },
            runs: {
                recent: run({ savedAt: "2026-09-10T10:00:00.000Z" }),
                old: run({ savedAt: "2026-08-01T10:00:00.000Z" }),
                broken: { ...run(), queue: "not a list" },
            },
            talks: {},
            resume: { href: "/lesson/recent", at: "2026-09-17T09:00:00.000Z" },
        };
        const soon = readData(stored, at("2026-09-17T09:20:00Z"));
        expect(Object.keys(soon.runs)).toEqual(["recent"]);
        expect(soon.resume?.href).toBe("/lesson/recent");

        const later = readData(stored, at("2026-09-17T10:00:00Z"));
        expect(later.resume).toBeNull();
        expect(readData({ version: 99 })).toEqual(emptyData());
    });
});

describe("where a lesson stands", () => {
    const base: ProgressData = { ...emptyData(), runs: { "mrt-basics": run() } };
    const mrt = { id: "mrt-basics", fingerprint: "f", speakable: true };
    const learned: ProgressData = {
        ...emptyData(),
        progress: withLessonDone({ lessons: {} }, "mrt-basics", { firstTryCorrect: 9, total: 9 }),
    };
    const talk = (results: string[], phase = "ready") => ({
        context: { goals: [{}, {}, {}, {}] },
        state: { phase, messages: [{ id: "m1" }], results, goalCount: 4, goalIndex: 0 },
        savedAt: "2026-09-17T12:00:00.000Z",
    });
    const talking = (results: string[], phase?: string): ProgressData =>
        ({ ...learned, talks: { "mrt-basics": talk(results, phase) } }) as unknown as ProgressData;

    it("is started only while a run that still fits is part-way through", () => {
        const fresh = { finished: "none", run: null, talk: null };
        expect(lessonStatus(base, mrt)).toEqual({ ...fresh, run: { done: 2, total: 4 } });
        // The lesson was edited, or this is yesterday's daily mix.
        expect(lessonStatus(base, { ...mrt, fingerprint: "changed" })).toEqual(fresh);
        expect(lessonStatus(emptyData(), mrt)).toEqual(fresh);
        expect(lessonStage(lessonStatus(base, mrt))).toBe("progress");
        expect(lessonStage(lessonStatus(emptyData(), mrt))).toBe("new");
    });

    it("keeps a finished lesson finished while it is being gone through again", () => {
        const again: ProgressData = {
            ...base,
            progress: withSpeakingDone(learned.progress, "mrt-basics", { said: 4, total: 4 }),
        };
        // Starting it again used to take the tick off Home and one lesson off
        // the count of lessons done, as if the first run had never happened.
        const status = lessonStatus(again, mrt);
        expect(status).toEqual({ finished: "done", run: { done: 2, total: 4 }, talk: null });
        expect(lessonStage(status)).toBe("done");
    });

    it("is not done until it has been said aloud", () => {
        // The exercises are the first of two stages. Marking the lesson done
        // here is what let the talk with the tutor pass for an optional extra.
        const status = lessonStatus(learned, mrt);
        expect(status.finished).toBe("learned");
        expect(lessonStage(status)).toBe("progress");

        const spoken = {
            ...learned,
            progress: withSpeakingDone(learned.progress, "mrt-basics", { said: 4, total: 4 }),
        };
        expect(lessonStatus(spoken, mrt).finished).toBe("done");
        expect(lessonStage(lessonStatus(spoken, mrt))).toBe("done");
    });

    it("is done by its exercises alone when there is nothing to say aloud", () => {
        const silent = { ...mrt, speakable: false };
        expect(lessonStatus(learned, silent).finished).toBe("done");
        expect(continuePoint(learned, [silent])).toBeNull();
    });

    it("shows how far a talk in flight has got", () => {
        expect(lessonStatus(talking(["said"]), mrt).talk).toEqual({ done: 1, total: 4 });
        // A talk that is over is not something to come back to.
        expect(lessonStatus(talking(["said"], "finished"), mrt).talk).toBeNull();
    });

    it("offers the most recent unfinished thing to continue", () => {
        const lessons = [mrt, { id: "hawker-food", fingerprint: "f", speakable: true }];
        expect(continuePoint(emptyData(), lessons)).toBeNull();
        expect(continuePoint(base, lessons)).toEqual({
            kind: "lesson",
            lessonId: "mrt-basics",
            done: 2,
            total: 4,
        });

        const withLater: ProgressData = {
            ...base,
            runs: {
                ...base.runs,
                "hawker-food": run({ savedAt: "2026-09-17T11:00:00.000Z", position: 1 }),
            },
        };
        expect(continuePoint(withLater, lessons)?.lessonId).toBe("hawker-food");
        // A run for a lesson that no longer exists is not offered.
        expect(continuePoint(withLater, [lessons[0]])?.lessonId).toBe("mrt-basics");
    });

    it("offers the talk a half-done lesson is waiting for", () => {
        expect(continuePoint(learned, [mrt])).toEqual({ kind: "speak", lessonId: "mrt-basics" });
        // Once begun, it is the talk itself that is carried on with.
        expect(continuePoint(talking(["said"]), [mrt])).toEqual({
            kind: "talk",
            lessonId: "mrt-basics",
            done: 1,
            total: 4,
        });
        const spoken = {
            ...learned,
            progress: withSpeakingDone(learned.progress, "mrt-basics", { said: 4, total: 4 }),
        };
        expect(continuePoint(spoken, [mrt])).toBeNull();
    });
});

describe("the daily mix", () => {
    it("is done today only by the learner's own calendar", () => {
        const record = {
            completedAt: new Date(2026, 8, 17, 23, 30).toISOString(),
            runs: 1,
            bestFirstTry: 1,
            total: 8,
        };
        expect(doneToday(record, new Date(2026, 8, 17, 23, 59))).toBe(true);
        expect(doneToday(record, new Date(2026, 8, 18, 0, 1))).toBe(false);
        expect(doneToday(undefined)).toBe(false);
    });
});
