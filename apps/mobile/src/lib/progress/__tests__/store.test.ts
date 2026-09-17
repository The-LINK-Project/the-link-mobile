import AsyncStorage from "@react-native-async-storage/async-storage";

import {
    completeLesson,
    completeSpeaking,
    eraseProgress,
    flushProgress,
    getProgressData,
    loadProgress,
    mergeRemoteProgress,
    resetProgressForTests,
    saveRun,
    setProgressListener,
    setResume,
    takeResume,
} from "../store";

const RUN = {
    fingerprint: "f",
    locale: "en",
    screenReader: false,
    queue: ["a", "b", "c"],
    position: 1,
    records: { a: { attempts: 1, firstTryCorrect: true } },
    requeued: [],
};

beforeEach(async () => {
    await AsyncStorage.clear();
});

/** What happens when the phone closes the app: memory goes, storage stays. */
async function relaunch(userId: string) {
    await flushProgress();
    resetProgressForTests();
    await loadProgress(userId);
}

it("brings a half-finished lesson back after the app is closed", async () => {
    await loadProgress("user_a");
    saveRun("mrt-basics", RUN, "/lesson/mrt-basics");

    await relaunch("user_a");
    expect(getProgressData().runs["mrt-basics"]).toMatchObject({
        position: 1,
        queue: ["a", "b", "c"],
    });
    expect(takeResume()).toBe("/lesson/mrt-basics");
    // Offered once: coming back to Home later must not bounce them in again.
    expect(takeResume()).toBeNull();
});

it("does not reopen a lesson the learner chose to leave", async () => {
    await loadProgress("user_a");
    saveRun("mrt-basics", RUN, "/lesson/mrt-basics");
    setResume(null);

    await relaunch("user_a");
    expect(takeResume()).toBeNull();
    // Their place is still kept for the Continue card.
    expect(getProgressData().runs["mrt-basics"]).toBeDefined();
});

it("turns a finished run into a finished lesson and tells the sync", async () => {
    await loadProgress("user_a");
    const changed = jest.fn();
    setProgressListener(changed);
    saveRun("mrt-basics", RUN, "/lesson/mrt-basics");
    completeLesson("mrt-basics", { firstTryCorrect: 8, total: 9 });
    completeSpeaking("mrt-basics", { said: 3, total: 4 });

    expect(changed).toHaveBeenCalledTimes(2);
    await relaunch("user_a");
    const data = getProgressData();
    expect(data.runs["mrt-basics"]).toBeUndefined();
    expect(data.resume).toBeNull();
    expect(data.progress.lessons["mrt-basics"]).toMatchObject({
        runs: 1,
        bestFirstTry: 8,
        speaking: { said: 3, total: 4 },
    });
});

it("keeps each account's progress apart on a shared phone", async () => {
    await loadProgress("user_a");
    completeLesson("mrt-basics", { firstTryCorrect: 9, total: 9 });

    await relaunch("user_b");
    expect(getProgressData().progress.lessons).toEqual({});

    await relaunch("user_a");
    expect(getProgressData().progress.lessons["mrt-basics"]).toBeDefined();
});

it("removes an account's progress from the phone when the account is deleted", async () => {
    await loadProgress("user_a");
    completeLesson("mrt-basics", { firstTryCorrect: 9, total: 9 });
    await eraseProgress("user_a");

    expect(getProgressData().progress.lessons).toEqual({});
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
});

it("starts afresh rather than crashing on storage it cannot read", async () => {
    await AsyncStorage.setItem("link.progress.v1.user_a", "{not json");
    await loadProgress("user_a");
    expect(getProgressData().progress.lessons).toEqual({});
});

it("folds the server's copy in and reports when the phone knows more", async () => {
    await loadProgress("user_a");
    completeLesson("mrt-basics", { firstTryCorrect: 9, total: 9 });
    const remote = {
        lessons: {
            "hawker-food": {
                completedAt: "2026-09-01T00:00:00.000Z",
                runs: 1,
                bestFirstTry: 4,
                total: 9,
            },
        },
    };
    expect(mergeRemoteProgress(remote)).toBe(true);
    expect(Object.keys(getProgressData().progress.lessons).sort()).toEqual([
        "hawker-food",
        "mrt-basics",
    ]);
    // Once the server has everything, there is nothing to send.
    expect(mergeRemoteProgress(getProgressData().progress)).toBe(false);
});
