import AsyncStorage from "@react-native-async-storage/async-storage";

import {
    eraseFirstLanguage,
    flushFirstLanguage,
    getFirstLanguage,
    getFirstLanguageChoice,
    isFirstLanguageLoaded,
    loadFirstLanguage,
    mergeRemoteFirstLanguage,
    resetFirstLanguageForTests,
    setFirstLanguage,
    setFirstLanguageListener,
    settleSentFirstLanguage,
    unloadFirstLanguage,
} from "../store";

const LONG_AGO = "2020-01-01T00:00:00.000Z";
const FAR_OFF = "2099-01-01T00:00:00.000Z";

beforeEach(async () => {
    await AsyncStorage.clear();
});

/** What happens when the phone closes the app: memory goes, storage stays. */
async function relaunch(userId: string) {
    await flushFirstLanguage();
    resetFirstLanguageForTests();
    await loadFirstLanguage(userId);
}

it("remembers the language after the app is closed", async () => {
    await loadFirstLanguage("user_a");
    await setFirstLanguage("bn");

    await relaunch("user_a");
    expect(getFirstLanguage()).toBe("bn");
    expect(isFirstLanguageLoaded()).toBe(true);
});

it("keeps each account's language apart on a shared phone", async () => {
    await loadFirstLanguage("user_a");
    await setFirstLanguage("bn");

    await relaunch("user_b");
    expect(getFirstLanguage()).toBeNull();
    await setFirstLanguage("ta");

    await relaunch("user_a");
    expect(getFirstLanguage()).toBe("bn");
});

it("forgets the language when nobody is signed in", async () => {
    await loadFirstLanguage("user_a");
    await setFirstLanguage("bn");
    unloadFirstLanguage();

    expect(getFirstLanguage()).toBeNull();
    expect(isFirstLanguageLoaded()).toBe(false);
});

it("asks again rather than crashing on storage it cannot read", async () => {
    await AsyncStorage.setItem("link.firstLanguage.v1.user_a", "{not json");
    await loadFirstLanguage("user_a");

    expect(getFirstLanguage()).toBeNull();
    expect(isFirstLanguageLoaded()).toBe(true);
});

it("drops a saved language it does not recognise", async () => {
    await AsyncStorage.setItem(
        "link.firstLanguage.v1.user_a",
        JSON.stringify({ language: "klingon", updatedAt: LONG_AGO }),
    );
    await loadFirstLanguage("user_a");

    expect(getFirstLanguage()).toBeNull();
});

it("keeps a saved language with no usable date, and lets the server win it", async () => {
    await AsyncStorage.setItem("link.firstLanguage.v1.user_a", JSON.stringify({ language: "bn" }));
    await loadFirstLanguage("user_a");

    expect(getFirstLanguage()).toBe("bn");
    expect(mergeRemoteFirstLanguage({ language: "ta", updatedAt: LONG_AGO })).toBe(false);
    expect(getFirstLanguage()).toBe("ta");
});

it("removes an account's language from the phone when the account is deleted", async () => {
    await loadFirstLanguage("user_a");
    await setFirstLanguage("bn");
    await eraseFirstLanguage("user_a");

    expect(getFirstLanguage()).toBeNull();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
});

it("tells the sync as soon as the learner chooses", async () => {
    await loadFirstLanguage("user_a");
    const changed = jest.fn();
    setFirstLanguageListener(changed);

    await setFirstLanguage("hi");
    expect(changed).toHaveBeenCalledTimes(1);
    setFirstLanguageListener(null);
});

describe("merging with the server", () => {
    it("takes the server's copy when it is newer", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");

        expect(mergeRemoteFirstLanguage({ language: "ta", updatedAt: FAR_OFF })).toBe(false);
        expect(getFirstLanguage()).toBe("ta");
    });

    it("keeps the phone's copy when it is newer, and says so", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");

        expect(mergeRemoteFirstLanguage({ language: "ta", updatedAt: LONG_AGO })).toBe(true);
        expect(getFirstLanguage()).toBe("bn");
    });

    it("gives a tie to the server", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");
        const mine = getFirstLanguageChoice();

        // The same millisecond is almost always the phone's own write coming
        // back, and preferring the server stops it being pushed again forever.
        expect(mergeRemoteFirstLanguage({ language: "ta", updatedAt: mine!.updatedAt })).toBe(
            false,
        );
        expect(getFirstLanguage()).toBe("ta");
    });

    it("reports the phone's copy as newer when the server has none", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");

        expect(mergeRemoteFirstLanguage(null)).toBe(true);
        expect(getFirstLanguage()).toBe("bn");
    });

    it("has nothing to say when neither side knows anything", async () => {
        await loadFirstLanguage("user_a");
        expect(mergeRemoteFirstLanguage(null)).toBe(false);
        expect(getFirstLanguage()).toBeNull();
    });

    it("writes the server's copy to this account's file", async () => {
        await loadFirstLanguage("user_a");
        mergeRemoteFirstLanguage({ language: "hi", updatedAt: FAR_OFF });

        await relaunch("user_a");
        expect(getFirstLanguage()).toBe("hi");
    });

    it("keeps an answer that arrives before the disk has been read", async () => {
        // The first sync can beat AsyncStorage on a cold launch. Whatever the
        // server said must survive the file that lands a moment later.
        await AsyncStorage.setItem(
            "link.firstLanguage.v1.user_a",
            JSON.stringify({ language: "bn", updatedAt: LONG_AGO }),
        );
        const loading = loadFirstLanguage("user_a");
        mergeRemoteFirstLanguage({ language: "ta", updatedAt: FAR_OFF });
        await loading;

        expect(getFirstLanguage()).toBe("ta");
    });
});

// A phone whose clock runs fast dates its choice in the future. The server
// takes that as the moment it first heard it; the phone has to come round to
// that date too, or it pushes the same choice for ever and beats later ones.
describe("a phone whose clock runs fast", () => {
    beforeEach(() => jest.useFakeTimers({ now: Date.parse("2026-10-24T09:00:00.000Z") }));
    afterEach(() => jest.useRealTimers());
    const heard = "2026-10-22T09:00:00.000Z";

    it("takes the server's date for the language they agree on, and has nothing to push", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");

        expect(mergeRemoteFirstLanguage({ language: "bn", updatedAt: heard })).toBe(false);
        expect(getFirstLanguageChoice()).toEqual({ language: "bn", updatedAt: heard });
    });

    it("then gives way to a later choice made on another phone", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");
        mergeRemoteFirstLanguage({ language: "bn", updatedAt: heard });

        const tamil = { language: "ta" as const, updatedAt: "2026-10-22T10:00:00.000Z" };
        expect(mergeRemoteFirstLanguage(tamil)).toBe(false);
        expect(getFirstLanguageChoice()).toEqual(tamil);
    });

    it("takes the server's answer to what it sent, whatever its own dates say", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");
        const sent = getFirstLanguageChoice()!;

        // Another phone chose Tamil, and the server kept it over this send.
        const kept = { language: "ta" as const, updatedAt: "2026-10-22T10:00:00.000Z" };
        settleSentFirstLanguage(sent, kept);
        expect(getFirstLanguageChoice()).toEqual(kept);
    });

    it("keeps a choice made while the answer was on its way", async () => {
        await loadFirstLanguage("user_a");
        await setFirstLanguage("bn");
        const sent = getFirstLanguageChoice()!;
        jest.advanceTimersByTime(1000);
        await setFirstLanguage("hi");

        settleSentFirstLanguage(sent, { language: "bn", updatedAt: heard });
        expect(getFirstLanguage()).toBe("hi");
    });
});

// A read that fails (Android's "database is locked", a full disk) is not the
// same as nothing stored. Writing after it would replace the learner's choice.
describe("storage that will not be read", () => {
    beforeEach(() => resetFirstLanguageForTests());
    const KEY = "link.firstLanguage.v1.user_a";
    const stored = { language: "bn", updatedAt: LONG_AGO };

    /** The next `times` reads fail; `mockRestore` puts the real ones back. */
    function failReads(times: number) {
        // The storage mock's getItem is itself a jest.fn, so spying on it hands
        // back that same function: keep its implementation to put back.
        const getItem = AsyncStorage.getItem as jest.Mock;
        const real = getItem.getMockImplementation()!;
        let left = times;
        getItem.mockImplementation((key: string) => {
            if (left > 0) {
                left--;
                return Promise.reject(new Error("database is locked"));
            }
            return real(key);
        });
        return { mockRestore: () => getItem.mockImplementation(real) };
    }

    it("tries the read again once, and then has the choice", async () => {
        await AsyncStorage.setItem(KEY, JSON.stringify(stored));
        const reads = failReads(1);

        await loadFirstLanguage("user_a");
        expect(getFirstLanguage()).toBe("bn");
        reads.mockRestore();
    });

    it("lets the learner in, and writes nothing over the stored choice", async () => {
        await AsyncStorage.setItem(KEY, JSON.stringify(stored));
        const reads = failReads(Number.POSITIVE_INFINITY);

        await loadFirstLanguage("user_a");
        expect(isFirstLanguageLoaded()).toBe(true);
        expect(getFirstLanguage()).toBeNull();
        // The server's copy still arrives and is used, from memory.
        mergeRemoteFirstLanguage({ language: "ta", updatedAt: LONG_AGO });
        expect(getFirstLanguage()).toBe("ta");
        await flushFirstLanguage();
        reads.mockRestore();
        expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual(stored);
    });

    it("folds the stored choice in once it can be read, newest first", async () => {
        await AsyncStorage.setItem(KEY, JSON.stringify(stored));
        const reads = failReads(2);
        await loadFirstLanguage("user_a");
        reads.mockRestore();

        // The learner answers again meanwhile; that is newer than what is stored.
        await setFirstLanguage("ta");
        await flushFirstLanguage();
        expect(getFirstLanguage()).toBe("ta");
        expect(JSON.parse((await AsyncStorage.getItem(KEY))!).language).toBe("ta");
    });

    it("takes the stored choice when the server's copy that arrived meanwhile is older", async () => {
        const recent = { language: "hi", updatedAt: "2026-10-01T00:00:00.000Z" };
        await AsyncStorage.setItem(KEY, JSON.stringify(recent));
        const reads = failReads(2);
        await loadFirstLanguage("user_a");
        reads.mockRestore();

        mergeRemoteFirstLanguage({ language: "bn", updatedAt: LONG_AGO });
        await flushFirstLanguage();
        expect(getFirstLanguage()).toBe("hi");
        expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual(recent);
    });
});
