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
