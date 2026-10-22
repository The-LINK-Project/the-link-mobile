import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "@/lib/api";

import { completeLesson, getProgressData, loadProgress, unloadProgress } from "../store";
import { syncProgress } from "../sync";

jest.mock("@/lib/api", () => ({
    api: { progress: jest.fn(), saveProgress: jest.fn() },
}));

const progress = api.progress as jest.Mock;
const saveProgress = api.saveProgress as jest.Mock;

/** A server answer that arrives when the test says so. */
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

const A_LESSON = {
    lessons: {
        "hawker-food": {
            completedAt: "2026-10-20T05:00:00.000Z",
            runs: 2,
            bestFirstTry: 6,
            total: 8,
        },
    },
};

beforeEach(async () => {
    await AsyncStorage.clear();
    progress.mockReset();
    saveProgress.mockReset().mockImplementation(async (body) => ({ progress: body }));
});

describe("syncing finished lessons with the server", () => {
    it("takes in what the server knows and sends back what only the phone knows", async () => {
        await loadProgress("user_a");
        completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
        progress.mockResolvedValue({ progress: A_LESSON });

        await syncProgress();

        expect(Object.keys(getProgressData().progress.lessons).sort()).toEqual([
            "hawker-food",
            "mrt-basics",
        ]);
        expect(saveProgress).toHaveBeenCalledTimes(1);
    });

    // A shared phone in a dormitory changes hands. One learner's lessons must
    // never turn up in the next learner's progress, or on their account.
    it("drops what the server sent when the phone changed hands while it was asked", async () => {
        await loadProgress("user_a");
        const answer = deferred<{ progress: unknown }>();
        progress.mockReturnValue(answer.promise);

        const sync = syncProgress();
        unloadProgress();
        await loadProgress("user_b");
        answer.resolve({ progress: A_LESSON });
        await sync;

        expect(getProgressData().progress.lessons).toEqual({});
        expect(saveProgress).not.toHaveBeenCalled();
    });

    it("drops what came back from a save when the phone changed hands during it", async () => {
        await loadProgress("user_a");
        completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
        progress.mockResolvedValue({ progress: { lessons: {} } });
        const saved = deferred<{ progress: unknown }>();
        saveProgress.mockReturnValue(saved.promise);

        const sync = syncProgress();
        await new Promise<void>((resolve) => setImmediate(() => resolve()));
        expect(saveProgress).toHaveBeenCalledTimes(1);
        unloadProgress();
        await loadProgress("user_b");
        saved.resolve({ progress: { lessons: { ...A_LESSON.lessons } } });
        await sync;

        expect(getProgressData().progress.lessons).toEqual({});
    });
});

// A phone whose clock runs days fast dates its lessons ahead of the server's
// clock, and the server keeps its own now in their place. That date is the
// server's answer, not news the phone still has to send.
describe("a phone whose clock runs fast", () => {
    const SERVER_NOW = "2026-10-22T04:00:00.000Z";
    /** The server's save: anything over a day ahead of its clock becomes its now. */
    const clampingSave = async (body: { lessons: Record<string, { completedAt: string }> }) => ({
        progress: {
            lessons: Object.fromEntries(
                Object.entries(body.lessons).map(([id, lesson]) => [
                    id,
                    {
                        ...lesson,
                        completedAt:
                            Date.parse(lesson.completedAt) > Date.parse(SERVER_NOW) + 86_400_000
                                ? SERVER_NOW
                                : lesson.completedAt,
                    },
                ]),
            ),
        },
    });

    afterEach(() => jest.useRealTimers());

    it("sends a lesson dated ahead once, not on every sync", async () => {
        unloadProgress();
        // Three days fast.
        jest.useFakeTimers({
            now: new Date("2026-10-25T04:00:00.000Z"),
            doNotFake: ["setImmediate"],
        });
        await loadProgress("user_fast");
        completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
        let server = { lessons: {} };
        progress.mockImplementation(async () => ({ progress: server }));
        saveProgress.mockImplementation(async (body) => {
            const saved = await clampingSave(body);
            server = saved.progress;
            return saved;
        });

        await syncProgress();
        await syncProgress();
        await syncProgress();

        expect(saveProgress).toHaveBeenCalledTimes(1);
        // The phone still shows its own date: "done today" is read by its clock.
        expect(getProgressData().progress.lessons["mrt-basics"].completedAt).toBe(
            "2026-10-25T04:00:00.000Z",
        );
    });
});
