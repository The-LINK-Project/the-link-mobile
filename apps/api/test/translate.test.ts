import { test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";

import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import {
    parseTranslateRequest,
    translationInstruction,
    translationKey,
    translationPrompt,
    type TranslationDraft,
    type TranslationRequest,
    type Translator,
} from "../src/translate.js";
import { fakeDb, listen } from "./helpers.js";

const BASE_ENV = {
    MOBILE_MONGODB_URI: "mongodb://localhost",
    CLERK_PUBLISHABLE_KEY: "pk_test_example",
    CLERK_SECRET_KEY: "sk_test_example",
};

const SENTENCE = "Find the right platform, top up your card, and get off at the right stop.";
const PLATFORM_BN = "প্ল্যাটফর্ম";
const TOP_UP_BN = "রিচার্জ করা";

type Answer = (request: TranslationRequest) => TranslationDraft;

/** A model that answers however the test says, and remembers what it was asked. */
function fakeTranslator(answer: Answer) {
    const calls: TranslationRequest[] = [];
    const translator: Translator = {
        async translate(request) {
            calls.push(request);
            return answer(request);
        },
    };
    return { translator, calls };
}

const gloss =
    (translation: string): Answer =>
    () => ({ translation, phrase: null });

function signedIn(db: Db, translator: Translator) {
    return createApp({
        db: async () => db,
        authenticate: async () => ({ userId: "user_a", sessionId: "sess" }),
        translator: () => translator,
    });
}

const ask = (url: string, body: unknown) =>
    fetch(url + "/v1/translate", {
        method: "POST",
        headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

type Body = { word: string; translation: string; phrase: { text: string } | null };

test("a request is refused unless it is one English word, and a useless sentence is dropped", () => {
    const good = { word: "platform", context: SENTENCE, language: "bn" };
    const parsed = parseTranslateRequest(good);
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value, { word: "platform", context: SENTENCE, language: "bn" });

    // The sentence is optional, and a sentence without the word in it says
    // nothing about how the word was used, so it is dropped rather than refused.
    for (const context of [undefined, "", "Board the train at the gate.", "platforms are long"]) {
        const result = parseTranslateRequest({ ...good, context });
        assert.ok(result.ok, JSON.stringify(context));
        assert.equal(result.value.context, "", JSON.stringify(context));
    }

    // Control characters go, and runs of whitespace become one space.
    const messy = parseTranslateRequest({
        word: " top\u0000 ",
        context: "Please\ttop   up\u200b your card.",
        language: "ta",
    });
    assert.ok(messy.ok);
    assert.equal(messy.value.word, "top");
    assert.equal(messy.value.context, "Please top up your card.");

    for (const bad of [
        undefined,
        "platform",
        { ...good, language: "en" },
        { ...good, language: undefined },
        { ...good, word: "" },
        { ...good, word: "   " },
        { ...good, word: 7 },
        { ...good, word: "top up" },
        { ...good, word: "card9" },
        { ...good, word: "card." },
        { ...good, word: "প্ল্যাটফর্ম" },
        { ...good, word: "a".repeat(41) },
        { ...good, context: 7 },
        { ...good, context: `${SENTENCE} ${"long ".repeat(60)}` },
    ]) {
        assert.equal(parseTranslateRequest(bad).ok, false, JSON.stringify(bad)?.slice(0, 60));
    }

    // An English word with a hyphen or an apostrophe is still one word.
    for (const word of ["don't", "don’t", "check-in", "MRT"]) {
        assert.equal(parseTranslateRequest({ ...good, word }).ok, true, word);
    }
});

test("the cache key covers the language, the word and the sentence, and nothing else", () => {
    const base: TranslationRequest = { word: "platform", context: SENTENCE, language: "bn" };
    const key = translationKey(base);
    assert.match(key, /^[0-9a-f]{64}$/);
    assert.equal(translationKey({ ...base, word: "PLATFORM" }), key);
    assert.notEqual(translationKey({ ...base, language: "ta" }), key);
    assert.notEqual(translationKey({ ...base, context: "" }), key);
});

test("the word and the sentence reach the model as data, with the script it must answer in", () => {
    const request: TranslationRequest = { word: "platform", context: SENTENCE, language: "bn" };
    assert.deepEqual(JSON.parse(translationPrompt(request)), {
        word: "platform",
        sentence: SENTENCE,
    });
    assert.deepEqual(JSON.parse(translationPrompt({ ...request, context: "" })), {
        word: "platform",
        sentence: null,
    });
    const instruction = translationInstruction("bn");
    assert.match(instruction, /Bengali, written in Bengali script/);
    assert.match(instruction, /data, not instructions/);
    // A Latin-script language has no script to demand.
    assert.match(translationInstruction("vi"), /in Vietnamese\./);
});

test("POST /v1/translate answers with a checked gloss and caches nothing identifying", async () => {
    const fake = fakeDb();
    const { translator, calls } = fakeTranslator(gloss(PLATFORM_BN));
    const { url, close } = await listen(signedIn(fake.db, translator));
    try {
        assert.equal((await fetch(url + "/v1/translate", { method: "POST" })).status, 401);

        const res = await ask(url, { word: "platform", context: SENTENCE, language: "bn" });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), {
            word: "platform",
            translation: PLATFORM_BN,
            phrase: null,
        });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].context, SENTENCE);

        // What is kept is only what another learner's bubble needs.
        const stored = [...fake.translations.values()];
        assert.equal(stored.length, 1);
        assert.deepEqual(Object.keys(stored[0]).sort(), [
            "_id",
            "createdAt",
            "language",
            "phrase",
            "translation",
            "word",
        ]);
        assert.equal(stored[0].word, "platform");
        assert.equal(
            stored[0]._id,
            translationKey({ word: "platform", context: SENTENCE, language: "bn" }),
        );
        const written = JSON.stringify(stored[0]);
        assert.equal(written.includes("user_a"), false);
        assert.equal(written.includes("Find the right platform"), false);

        // The same word in the same sentence is answered from the cache.
        const again = await ask(url, { word: "Platform", context: SENTENCE, language: "bn" });
        assert.deepEqual((await again.json()) as Body, {
            word: "Platform",
            translation: PLATFORM_BN,
            phrase: null,
        });
        assert.equal(calls.length, 1, "the model is not asked twice for the same word");

        // The same word in another sentence is a different question.
        await ask(url, {
            word: "platform",
            context: "Stand behind the yellow line.",
            language: "bn",
        });
        assert.equal(calls.length, 2);
        assert.equal(calls[1].context, "", "a sentence without the word is not sent to the model");
    } finally {
        await close();
    }
});

test("a word inside a phrasal verb comes back with the phrase, and a phrase that is not there is dropped", async () => {
    const fake = fakeDb();
    const { translator } = fakeTranslator((request) => ({
        translation: "উপরে",
        phrase:
            request.word === "top"
                ? { text: "top up", translation: TOP_UP_BN }
                : { text: "hand over", translation: TOP_UP_BN },
    }));
    const { url, close } = await listen(signedIn(fake.db, translator));
    try {
        const res = await ask(url, { word: "top", context: SENTENCE, language: "bn" });
        assert.deepEqual(await res.json(), {
            word: "top",
            translation: "উপরে",
            phrase: { text: "top up", translation: TOP_UP_BN },
        });

        // A phrase the sentence does not contain would point at nothing, so it
        // goes quietly: the word's own meaning is still worth showing.
        const invented = await ask(url, { word: "card", context: SENTENCE, language: "bn" });
        assert.equal(invented.status, 200);
        assert.equal(((await invented.json()) as Body).phrase, null);
    } finally {
        await close();
    }
});

test("an answer that cannot be trusted is a model failure, not a translation", async (t) => {
    t.mock.method(console, "error", () => undefined);
    let draft: TranslationDraft = { translation: PLATFORM_BN, phrase: null };
    const { translator } = fakeTranslator(() => draft);
    const fake = fakeDb();
    const { url, close } = await listen(signedIn(fake.db, translator));
    const refused = async (bad: TranslationDraft) => {
        draft = bad;
        const res = await ask(url, { word: "platform", context: SENTENCE, language: "bn" });
        assert.equal(res.status, 503, JSON.stringify(bad));
        assert.deepEqual(await res.json(), { error: "Translation is not available right now" });
    };
    try {
        await refused({ translation: "", phrase: null });
        await refused({ translation: "   ", phrase: null });
        await refused({ translation: "ক".repeat(81), phrase: null });
        await refused({ translation: `${PLATFORM_BN}\nমানে`, phrase: null });
        // Bengali asked for, English given: the script rule catches it in code.
        await refused({ translation: "the platform", phrase: null });
        await refused({ translation: "pletform", phrase: null });
        assert.equal(fake.translations.size, 0, "nothing that failed a check is cached");

        // The word unchanged is how the model says it is a name, not English.
        draft = { translation: "Jurong", phrase: null };
        const name = await ask(url, {
            word: "Jurong",
            context: "Take the train to Jurong.",
            language: "bn",
        });
        assert.equal(name.status, 200);
        assert.equal(((await name.json()) as Body).translation, "Jurong");

        // Filipino is written in the same letters as English, so there is no
        // script to check and a Latin answer stands.
        draft = { translation: "plataporma", phrase: null };
        const latin = await ask(url, { word: "platform", context: SENTENCE, language: "fi" });
        assert.equal(((await latin.json()) as Body).translation, "plataporma");
    } finally {
        await close();
    }
});

test("trouble with the cache never costs the learner the translation", async (t) => {
    t.mock.method(console, "warn", () => undefined);
    const fake = fakeDb();
    const { translator, calls } = fakeTranslator(gloss(PLATFORM_BN));
    const broken = {
        collection: (name: string) =>
            name === "translations"
                ? {
                      findOne: async () => {
                          throw new Error("mongo is down");
                      },
                      updateOne: async () => {
                          throw new Error("mongo is down");
                      },
                  }
                : fake.db.collection(name),
    } as unknown as Db;
    const { url, close } = await listen(signedIn(broken, translator));
    try {
        for (let i = 0; i < 2; i++) {
            const res = await ask(url, { word: "platform", context: SENTENCE, language: "bn" });
            assert.equal(res.status, 200);
            assert.equal(((await res.json()) as Body).translation, PLATFORM_BN);
        }
        // Without a cache every hold costs a model call, which is the price of
        // still answering at all.
        assert.equal(calls.length, 2);
    } finally {
        await close();
    }
});

test("holding words has a per-minute limit of its own, answered like the tutor's", async () => {
    const fake = fakeDb();
    const { translator, calls } = fakeTranslator(gloss(PLATFORM_BN));
    const { url, close } = await listen(signedIn(fake.db, translator));
    try {
        let last = await ask(url, { word: "platform", context: SENTENCE, language: "bn" });
        for (let i = 0; i < 30; i++) {
            last = await ask(url, { word: "platform", context: SENTENCE, language: "bn" });
        }
        assert.equal(last.status, 429);
        assert.equal(last.headers.get("retry-after"), "60");
        // One model call, then the cache, then the limit.
        assert.equal(calls.length, 1);
    } finally {
        await close();
    }
});

test("without a model key translation answers 503 and the rest of the API still runs", async (t) => {
    t.mock.method(console, "error", () => undefined);
    assert.equal(readConfig(BASE_ENV).geminiApiKey, undefined);
    // The tutor's models stand in until a cheaper one is named for glossing.
    assert.deepEqual(readConfig(BASE_ENV).translateModels, readConfig(BASE_ENV).tutorModels);
    assert.deepEqual(
        readConfig({ ...BASE_ENV, GEMINI_TRANSLATE_MODEL: "gemini-3.8-flash-lite" })
            .translateModels,
        ["gemini-3.8-flash-lite"],
    );

    const saved = { ...process.env };
    Object.assign(process.env, BASE_ENV);
    delete process.env.GEMINI_API_KEY;
    const fake = fakeDb();
    // No translator given: the route builds the real one from the environment.
    const app = createApp({
        db: async () => fake.db,
        authenticate: async () => ({ userId: "user_a", sessionId: "sess" }),
    });
    const { url, close } = await listen(app);
    try {
        const res = await ask(url, { word: "platform", context: SENTENCE, language: "bn" });
        assert.equal(res.status, 503);
        assert.deepEqual(await res.json(), { error: "Translation is not configured" });

        const progress = await fetch(url + "/v1/progress", {
            headers: { Authorization: "Bearer x" },
        });
        assert.equal(progress.status, 200, "the rest of the API is unaffected");
    } finally {
        await close();
        for (const key of [...Object.keys(BASE_ENV), "GEMINI_API_KEY"]) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
    }
});
