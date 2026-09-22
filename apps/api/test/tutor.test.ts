import { pcmToWav } from "../src/audio.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Db } from "mongodb";

import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { speechChunks } from "../src/gemini.js";
import { TRANSLATION_LANGUAGES } from "../src/languages.js";
import {
    allowedWords,
    decideOutcome,
    fallbackReply,
    findViolations,
    MAX_ASIDES,
    parseTurnRequest,
    readTranscript,
    restoreNames,
    runTurn,
    TUTOR_LANGUAGES,
    type Draft,
    type TurnRequest,
    type TutorModel,
} from "../src/tutor.js";

const BASE_ENV = {
    MOBILE_MONGODB_URI: "mongodb://localhost",
    CLERK_PUBLISHABLE_KEY: "pk_test_example",
    CLERK_SECRET_KEY: "sk_test_example",
};

const ASK_PLATFORM = "জুরং ইস্ট যাওয়ার প্ল্যাটফর্ম কোনটি, তা জিজ্ঞাসা করা।";
const ASK_TAP_OUT = "বের হওয়ার সময় গেটে কার্ড ছোঁয়ানো";

const OPENING = {
    language: "bn",
    scene: "The learner is at an MRT station. You are the station staff.",
    words: ["platform", "top up", "tap out"],
    phrases: ["Which platform for Jurong East?"],
    names: ["MRT", "Jurong East"],
    goals: [
        {
            id: "platform",
            target: "Which platform for Jurong East?",
            keywords: ["which", "platform", "jurong east"],
            ask: ASK_PLATFORM,
        },
        { id: "tap-out", target: "tap out", keywords: ["tap out"], ask: ASK_TAP_OUT },
    ],
    goalIndex: 0,
    attempt: 1,
    history: [],
};

const RECORDING = {
    mimeType: "audio/wav",
    data: Buffer.from("not really audio").toString("base64"),
};

/** A learner's turn at a goal, after the tutor's opening line. */
function learnerTurn(goalIndex: number, attempt: number, asides = 0) {
    return {
        ...OPENING,
        goalIndex,
        attempt,
        asides,
        history: [{ role: "tutor", text: ASK_PLATFORM }],
        audio: RECORDING,
    };
}

function valid(body: unknown): TurnRequest {
    const result = parseTurnRequest(body);
    if (!result.ok) throw new Error(result.error);
    return result.value;
}

function rejection(body: unknown): string {
    const result = parseTurnRequest(body);
    assert.equal(result.ok, false);
    return result.ok ? "" : result.error;
}

function fakeModel(draft: Partial<Draft> = {}, overrides: Partial<TutorModel> = {}) {
    const calls = { rewrites: [] as string[], spoken: [] as string[] };
    const model: TutorModel = {
        async transcribe() {
            return "Which platform for Jurong East?";
        },
        async draft() {
            return {
                attempted: true,
                goalMet: false,
                reply: `${ASK_PLATFORM} Which platform for Jurong East?`,
                ...draft,
            };
        },
        async rewrite({ prompt }) {
            calls.rewrites.push(prompt);
            return "খুব ভালো! Which platform for Jurong East?";
        },
        async speak({ text }) {
            calls.spoken.push(text);
            return pcmToWav(Buffer.alloc(480));
        },
        ...overrides,
    };
    return { model, calls };
}

async function listen(app: ReturnType<typeof createApp>) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const url = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    const close = async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    };
    return { url, close };
}

function rateLimitDb() {
    const counters = new Map<string, number>();
    return {
        collection: () => ({
            async findOneAndUpdate(filter: { _id: string }) {
                const count = (counters.get(filter._id) ?? 0) + 1;
                counters.set(filter._id, count);
                return { _id: filter._id, count };
            },
        }),
    } as unknown as Db;
}

const signedIn = async () => ({ userId: "user_a", sessionId: "sess" });

const postTurn = (url: string, body: unknown) =>
    fetch(url + "/v1/tutor/turn", {
        method: "POST",
        headers: { Authorization: "Bearer x", "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

test("the word rule allows taught English, place names and function words, in any case", () => {
    const allowed = allowedWords(valid(OPENING));
    assert.deepEqual(
        findViolations("আপনি Platform থেকে top up করুন, the MRT and Jurong East", allowed),
        [],
    );
    // "tap out" is taught as a term, so each of its words may be used alone.
    assert.deepEqual(findViolations("কার্ড tap করুন, তারপর out", allowed), []);
    assert.deepEqual(findViolations("Good job! আবার say platform, OK?", allowed), [
        "good",
        "job",
        "say",
        "ok",
    ]);
});

test("Hindi is checked like Bengali and Tamil, since Devanagari keeps English visible", () => {
    const hindi = valid({ ...OPENING, language: "hi" });
    const allowed = allowedWords(hindi);
    assert.deepEqual(
        findViolations("आप MRT स्टेशन पर हैं। Which platform for Jurong East?", allowed),
        [],
    );
    assert.deepEqual(findViolations("बहुत good! फिर से try कीजिए।", allowed), ["good", "try"]);
    assert.match(fallbackReply({ ...hindi, audio: RECORDING }, "retry"), /फिर से/);
});

test("the tutor teaches from every language a word can be translated into", () => {
    assert.deepEqual([...TUTOR_LANGUAGES], [...TRANSLATION_LANGUAGES]);
});

test("a goal's meaning may be in a Latin-script language", () => {
    // The phone sends each goal's meaning in the learner's language. In French
    // every word of it looks like English to the regex, so only the English
    // parts of the goal are held to the lesson's words.
    const french = { ...OPENING.goals[0], ask: "Quel quai pour Jurong East ? Demandez le quai." };
    assert.equal(valid({ ...OPENING, language: "fr", goals: [french] }).goals[0].ask, french.ask);
    assert.equal(
        rejection({
            ...OPENING,
            language: "fr",
            goals: [{ ...french, keywords: ["platform", "ticket"] }],
        }),
        "A goal uses English the lesson did not teach",
    );
    // A language with its own script still has its meaning checked.
    assert.equal(
        rejection({ ...OPENING, language: "te", goals: [french] }),
        "A goal uses English the lesson did not teach",
    );
});

test("turn requests are checked before any model is called", () => {
    for (const language of TUTOR_LANGUAGES) {
        assert.equal(valid({ ...OPENING, language }).language, language);
    }
    assert.equal(
        rejection({ ...OPENING, goals: [{ ...OPENING.goals[0], ask: `${ASK_PLATFORM} please` }] }),
        "A goal uses English the lesson did not teach",
    );
    assert.equal(
        rejection({ ...OPENING, history: [{ role: "tutor", text: ASK_PLATFORM }] }),
        "A recording is required",
    );
    assert.equal(rejection(learnerTurn(0, 4)), "Invalid turn");
    assert.equal(rejection(learnerTurn(2, 1)), "Invalid turn");
    assert.equal(rejection(learnerTurn(0, 1, MAX_ASIDES + 1)), "Invalid turn");
    assert.equal(
        rejection({
            ...learnerTurn(0, 1),
            audio: { mimeType: "audio/wav", data: Buffer.alloc(1_600_000).toString("base64") },
        }),
        "Recording is too long",
    );
    assert.equal(
        rejection({ ...learnerTurn(0, 1), audio: { mimeType: "video/mp4", data: RECORDING.data } }),
        "Invalid recording",
    );
    assert.equal(valid(learnerTurn(1, 3)).goals.length, 2);
    // An app build from before questions were counted sends no asides at all.
    assert.equal(valid(OPENING).asides, 0);
});

test("a met goal moves on, a missed last try moves on anyway, and the last goal finishes", () => {
    const said = { understood: true, attempted: true, goalMet: true };
    const missed = { understood: true, attempted: true, goalMet: false };
    assert.deepEqual(decideOutcome(valid(OPENING), missed), {
        outcome: "opening",
        finished: false,
    });
    assert.deepEqual(decideOutcome(valid(learnerTurn(0, 1)), said), {
        outcome: "met",
        finished: false,
    });
    assert.deepEqual(decideOutcome(valid(learnerTurn(0, 1)), missed), {
        outcome: "retry",
        finished: false,
    });
    assert.deepEqual(decideOutcome(valid(learnerTurn(0, 3)), missed), {
        outcome: "moveOn",
        finished: false,
    });
    assert.deepEqual(decideOutcome(valid(learnerTurn(1, 2)), said), {
        outcome: "met",
        finished: true,
    });
    // An unclear recording is a try, so a broken microphone cannot loop forever.
    assert.deepEqual(
        decideOutcome(valid(learnerTurn(1, 3)), {
            understood: false,
            attempted: false,
            goalMet: true,
        }),
        { outcome: "moveOn", finished: true },
    );
});

test("a question does not use up a try, until the learner has asked a lot on one goal", () => {
    const asked = { understood: true, attempted: false, goalMet: false };
    assert.deepEqual(decideOutcome(valid(learnerTurn(0, 3)), asked), {
        outcome: "aside",
        finished: false,
    });
    assert.deepEqual(decideOutcome(valid(learnerTurn(0, 3, MAX_ASIDES)), asked), {
        outcome: "moveOn",
        finished: false,
    });
    assert.equal(fallbackReply(valid(learnerTurn(0, 1)), "aside"), ASK_PLATFORM);
});

test("a recording is written down without the lesson's answers, then judged from those words", async () => {
    const seen = { transcriber: [] as string[], judge: [] as string[] };
    const { model } = fakeModel(
        {},
        {
            async transcribe({ system, prompt }) {
                seen.transcriber.push(`${system}\n${prompt}`);
                return "I want to buy a train ticket";
            },
            async draft({ prompt }) {
                seen.judge.push(prompt);
                return { attempted: true, goalMet: false, reply: ASK_PLATFORM };
            },
        },
    );

    await runTurn(valid(OPENING), model);
    assert.equal(seen.transcriber.length, 0);

    const result = await runTurn(valid(learnerTurn(0, 1)), model);
    assert.equal(seen.transcriber.length, 1);
    for (const answer of ["Which platform", "Jurong East", ASK_PLATFORM]) {
        assert.ok(!seen.transcriber[0].includes(answer), `the transcriber was told "${answer}"`);
    }
    assert.match(seen.judge[1], /"I want to buy a train ticket"/);
    assert.equal(result.heard, "I want to buy a train ticket");
});

test("a recording with nobody speaking is a missed try, whatever the reply model says", async () => {
    assert.equal(readTranscript(" NO SPEECH "), "");
    assert.equal(readTranscript('"No speech."'), "");
    assert.equal(readTranscript(""), "");
    assert.equal(readTranscript("which\n platform "), "which platform");

    const { model } = fakeModel(
        { goalMet: true },
        {
            async transcribe() {
                return "NO SPEECH.";
            },
        },
    );
    const result = await runTurn(valid(learnerTurn(0, 1)), model);
    assert.equal(result.heard, "");
    assert.equal(result.outcome, "retry");
});

test("a reply with untaught English is rewritten before anything is spoken", async (t) => {
    t.mock.method(console, "info", () => undefined);
    const { model, calls } = fakeModel({ reply: "Good! Which platform for Jurong East?" });
    const result = await runTurn(valid(OPENING), model);

    assert.equal(calls.rewrites.length, 1);
    assert.match(calls.rewrites[0], /good/);
    assert.equal(result.reply, "খুব ভালো! Which platform for Jurong East?");
    assert.deepEqual(calls.spoken, [result.reply]);
});

test("a model that keeps breaking the rule, or says nothing, is replaced by lesson content", async (t) => {
    t.mock.method(console, "info", () => undefined);
    const request = valid(learnerTurn(0, 1));
    const stubborn = fakeModel(
        { reply: "Okay, try again!" },
        {
            async rewrite() {
                return "Nice try, say it again.";
            },
        },
    );
    const result = await runTurn(request, stubborn.model);
    assert.equal(result.outcome, "retry");
    assert.equal(result.reply, fallbackReply(request, "retry"));
    assert.deepEqual(findViolations(result.reply, allowedWords(request)), []);
    assert.deepEqual(stubborn.calls.spoken, [result.reply]);

    const silent = fakeModel({ reply: "  ", goalMet: true });
    const next = await runTurn(request, silent.model);
    assert.equal(next.reply, fallbackReply(request, "met"));
    assert.equal(silent.calls.rewrites.length, 0);
});

test("names keep the lesson's capital letters, so MRT is read out as letters", async () => {
    assert.equal(
        restoreNames("একটি mrt স্টেশন, jurong EAST যাবেন?", ["MRT", "Jurong East"]),
        "একটি MRT স্টেশন, Jurong East যাবেন?",
    );
    const { model, calls } = fakeModel({ reply: "আপনি mrt স্টেশনে আছেন।" });
    const result = await runTurn(valid(OPENING), model);
    assert.equal(result.reply, "আপনি MRT স্টেশনে আছেন।");
    assert.deepEqual(calls.spoken, [result.reply]);
});

test("when speech fails the checked reply is still returned, without audio", async (t) => {
    t.mock.method(console, "error", () => undefined);
    let tries = 0;
    const { model } = fakeModel(
        {},
        {
            async speak() {
                tries++;
                throw new Error("Gemini answered 500");
            },
        },
    );
    const result = await runTurn(valid(OPENING), model);
    assert.equal(result.audio, null);
    assert.equal(tries, 2);
    assert.ok(result.reply.length > 0);
});

test("speech gets one budget for both tries, so a stalled voice cannot double the wait", async (t) => {
    t.mock.method(console, "error", () => undefined);
    let clock = 0;
    let tries = 0;
    const { model } = fakeModel(
        {},
        {
            async speak() {
                tries++;
                clock += 28_000;
                throw new Error("Gemini timed out");
            },
        },
    );
    const result = await runTurn(valid(OPENING), model, () => clock);
    assert.equal(tries, 1);
    assert.equal(result.audio, null);
});

test("speech is wrapped as a playable 16-bit mono WAV", () => {
    const wav = pcmToWav(Buffer.alloc(4800), 24_000);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    assert.equal(wav.readUInt32LE(24), 24_000);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.readUInt32LE(40), 4800);
    assert.equal(wav.length, 44 + 4800);
});

test("speech is split between sentences, with a short one joined to the next", () => {
    const long = (letter: string) => letter.repeat(70);
    const text = `নমস্কার! ${long("ক")}। ${long("খ")}? ${"গ".repeat(10)}।`;
    assert.deepEqual(speechChunks(text), [
        `নমস্কার! ${long("ক")}।`,
        `${long("খ")}?`,
        `${"গ".repeat(10)}।`,
    ]);
    assert.deepEqual(speechChunks("আবার চেষ্টা করুন"), ["আবার চেষ্টা করুন"]);
    assert.deepEqual(speechChunks("  "), []);
});

test("speaking practice is optional configuration, and a placeholder key counts as missing", () => {
    const config = readConfig(BASE_ENV);
    assert.equal(config.geminiApiKey, undefined);
    assert.equal(readConfig({ ...BASE_ENV, GEMINI_API_KEY: "replace_me" }).geminiApiKey, undefined);
    assert.equal(readConfig({ ...BASE_ENV, GEMINI_API_KEY: "key" }).geminiApiKey, "key");
});

test("POST /v1/tutor/turn answers with a checked reply and playable audio", async () => {
    const { model } = fakeModel();
    const app = createApp({
        db: async () => rateLimitDb(),
        authenticate: signedIn,
        tutor: () => model,
    });
    const { url, close } = await listen(app);
    try {
        const res = await postTurn(url, OPENING);
        assert.equal(res.status, 200);
        const body = (await res.json()) as {
            heard: string;
            outcome: string;
            finished: boolean;
            audio: { mimeType: string; data: string } | null;
        };
        assert.equal(body.outcome, "opening");
        assert.equal(body.heard, "");
        assert.equal(body.finished, false);
        assert.equal(body.audio?.mimeType, "audio/wav");
        assert.equal(Buffer.from(body.audio?.data ?? "", "base64").toString("ascii", 0, 4), "RIFF");
    } finally {
        await close();
    }
});

test("POST /v1/tutor/turn needs sign-in, rejects bad input without a model, and reports model failure as 503", async (t) => {
    t.mock.method(console, "error", () => undefined);
    let built = 0;
    const failing: TutorModel = {
        ...fakeModel().model,
        async draft() {
            throw new Error("Gemini answered 500");
        },
    };
    const app = createApp({
        db: async () => rateLimitDb(),
        authenticate: signedIn,
        tutor: () => {
            built++;
            return failing;
        },
    });
    const { url, close } = await listen(app);
    try {
        const anonymous = await fetch(url + "/v1/tutor/turn", { method: "POST", body: "{}" });
        assert.equal(anonymous.status, 401);

        const bad = await postTurn(url, { ...OPENING, language: "xx" });
        assert.equal(bad.status, 400);
        assert.deepEqual(await bad.json(), { error: "Unsupported language" });
        assert.equal(built, 0);

        const down = await postTurn(url, OPENING);
        assert.equal(down.status, 503);
        assert.deepEqual(await down.json(), { error: "The tutor is not available right now" });
    } finally {
        await close();
    }
});

test("tutor turns have their own, tighter per-minute limit", async () => {
    const { model } = fakeModel();
    const db = rateLimitDb();
    const app = createApp({ db: async () => db, authenticate: signedIn, tutor: () => model });
    const { url, close } = await listen(app);
    try {
        const statuses: number[] = [];
        for (let i = 0; i < 13; i++) statuses.push((await postTurn(url, OPENING)).status);
        assert.deepEqual(statuses.slice(0, 12), Array(12).fill(200));
        assert.equal(statuses[12], 429);
    } finally {
        await close();
    }
});
