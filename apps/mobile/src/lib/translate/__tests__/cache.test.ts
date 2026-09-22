import AsyncStorage from "@react-native-async-storage/async-storage";

import {
    TRANSLATION_CACHE_LIMIT,
    flushTranslationCache,
    readTranslationCache,
    resetTranslationCacheForTests,
    translationCacheKey,
    writeTranslationCache,
} from "../cache";

const SENTENCE = "Which platform for Jurong East?";

beforeEach(async () => {
    await AsyncStorage.clear();
    resetTranslationCacheForTests();
});

/** What happens when the phone closes the app: memory goes, storage stays. */
async function relaunch() {
    await flushTranslationCache();
    resetTranslationCacheForTests();
}

it("answers a word it has seen before, with no connection and no memory of it", async () => {
    writeTranslationCache("platform", SENTENCE, "bn", { translation: "প্ল্যাটফর্ম", phrase: null });

    await relaunch();
    expect(await readTranslationCache("platform", SENTENCE, "bn")).toEqual({
        word: "platform",
        translation: "প্ল্যাটফর্ম",
        phrase: null,
        source: "cache",
    });
});

it("keeps the expression it was given with the word", async () => {
    writeTranslationCache("top", "I want to top up ten dollars.", "bn", {
        translation: "উপরে",
        phrase: { text: "top up", translation: "রিচার্জ করা" },
    });

    await relaunch();
    const found = await readTranslationCache("top", "I want to top up ten dollars.", "bn");
    expect(found?.phrase).toEqual({ text: "top up", translation: "রিচার্জ করা" });
});

it("treats the same word in another sentence as another question", async () => {
    writeTranslationCache("top", "I want to top up ten dollars.", "bn", {
        translation: "রিচার্জ",
        phrase: null,
    });

    expect(await readTranslationCache("top", "It is on the top shelf.", "bn")).toBeNull();
});

it("does not answer in a language it was not asked about", async () => {
    writeTranslationCache("platform", SENTENCE, "bn", { translation: "প্ল্যাটফর্ম", phrase: null });

    expect(await readTranslationCache("platform", SENTENCE, "ta")).toBeNull();
});

it("asks the same question the same way however it was typed", () => {
    expect(translationCacheKey("Platform", "  Which  platform for\nJurong East? ")).toBe(
        translationCacheKey("platform", "Which platform for Jurong East?"),
    );
});

it("drops the oldest answers rather than growing without end", async () => {
    for (let index = 0; index <= TRANSLATION_CACHE_LIMIT; index++) {
        writeTranslationCache(`word${index}`, SENTENCE, "bn", {
            translation: `meaning${index}`,
            phrase: null,
        });
    }

    await relaunch();
    expect(await readTranslationCache("word0", SENTENCE, "bn")).toBeNull();
    expect(await readTranslationCache("word1", SENTENCE, "bn")).toMatchObject({
        translation: "meaning1",
    });
    expect(
        await readTranslationCache(`word${TRANSLATION_CACHE_LIMIT}`, SENTENCE, "bn"),
    ).toMatchObject({ translation: `meaning${TRANSLATION_CACHE_LIMIT}` });
});

it("counts a word looked up again as the newest one", async () => {
    writeTranslationCache("word0", SENTENCE, "bn", { translation: "first", phrase: null });
    for (let index = 1; index <= TRANSLATION_CACHE_LIMIT; index++) {
        writeTranslationCache(`word${index}`, SENTENCE, "bn", {
            translation: `meaning${index}`,
            phrase: null,
        });
        if (index === 1) {
            writeTranslationCache("word0", SENTENCE, "bn", { translation: "again", phrase: null });
        }
    }

    await relaunch();
    expect(await readTranslationCache("word0", SENTENCE, "bn")).toMatchObject({
        translation: "again",
    });
});

it("never throws at the learner when the phone cannot write", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));

    expect(() =>
        writeTranslationCache("platform", SENTENCE, "bn", {
            translation: "প্ল্যাটফর্ম",
            phrase: null,
        }),
    ).not.toThrow();
    await expect(flushTranslationCache()).resolves.toBeUndefined();
    // The answer is still in memory for the rest of this session.
    expect(await readTranslationCache("platform", SENTENCE, "bn")).toMatchObject({
        translation: "প্ল্যাটফর্ম",
    });
    jest.restoreAllMocks();
});

it("starts empty rather than crashing on a file it cannot read", async () => {
    await AsyncStorage.setItem("link.translate.v1.bn", "{not json");

    expect(await readTranslationCache("platform", SENTENCE, "bn")).toBeNull();
});

it("keeps an answer written while the file was still being read", async () => {
    await AsyncStorage.setItem(
        "link.translate.v1.bn",
        JSON.stringify({
            version: 1,
            entries: [
                [translationCacheKey("fare", SENTENCE), { translation: "ভাড়া", phrase: null }],
            ],
        }),
    );

    const reading = readTranslationCache("fare", SENTENCE, "bn");
    writeTranslationCache("platform", SENTENCE, "bn", { translation: "প্ল্যাটফর্ম", phrase: null });

    expect(await reading).toMatchObject({ translation: "ভাড়া" });
    expect(await readTranslationCache("platform", SENTENCE, "bn")).toMatchObject({
        translation: "প্ল্যাটফর্ম",
    });
});
