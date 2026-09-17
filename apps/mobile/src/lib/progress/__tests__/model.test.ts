import {
    continuePoint,
    doneToday,
    emptyData,
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

    it("is started only while a run that still fits is part-way through", () => {
        expect(lessonStatus(base, "mrt-basics", "f")).toEqual({
            kind: "started",
            done: 2,
            total: 4,
            finishedBefore: false,
        });
        // The lesson was edited, or this is yesterday's daily mix.
        expect(lessonStatus(base, "mrt-basics", "changed")).toEqual({ kind: "new" });
        expect(lessonStatus(emptyData(), "mrt-basics", "f")).toEqual({ kind: "new" });
    });

    it("moves from learned to spoken", () => {
        const learned = {
            ...emptyData(),
            progress: withLessonDone({ lessons: {} }, "mrt-basics", {
                firstTryCorrect: 9,
                total: 9,
            }),
        };
        expect(lessonStatus(learned, "mrt-basics", "f").kind).toBe("learned");
        const spoken = {
            ...learned,
            progress: withSpeakingDone(learned.progress, "mrt-basics", { said: 4, total: 4 }),
        };
        expect(lessonStatus(spoken, "mrt-basics", "f").kind).toBe("spoken");
    });

    it("offers the most recent unfinished thing to continue", () => {
        const lessons = [
            { id: "mrt-basics", fingerprint: "f" },
            { id: "hawker-food", fingerprint: "f" },
        ];
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
