import { pcmToWav } from "../src/audio.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";

import { parseServiceAccount } from "../src/cloud-speech.js";
import { readConfig } from "../src/config.js";
import { createGeminiTutor, readAloud, speechChunks } from "../src/gemini.js";
import { QuotaError, READ_ALOUD } from "../src/google.js";

const BASE_ENV = {
    MOBILE_MONGODB_URI: "mongodb://localhost",
    CLERK_PUBLISHABLE_KEY: "pk_test_example",
    CLERK_SECRET_KEY: "sk_test_example",
};

const TEXT_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash"];
const VOICES = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SYNTHESIZE_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const TRANSCRIBE = {
    system: "Write it down.",
    prompt: "What was said?",
    audio: { mimeType: "audio/wav", data: Buffer.from("audio").toString("base64") },
};

type Call = { url: string; body: string; headers: Headers };

/** Answers every fetch from the URL, and records the calls. */
function fakeFetch(t: TestContext, answer: (url: string) => Response | Promise<Response>) {
    const calls: Call[] = [];
    t.mock.method(
        globalThis,
        "fetch",
        async (input: string | URL | Request, init?: RequestInit) => {
            const url = String(input);
            calls.push({
                url,
                body: String(init?.body ?? ""),
                headers: new Headers(init?.headers),
            });
            return answer(url);
        },
    );
    return calls;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const outOfQuota = (seconds: number) =>
    json(
        {
            error: {
                message: "You exceeded your current quota",
                details: [
                    {
                        "@type": "type.googleapis.com/google.rpc.RetryInfo",
                        retryDelay: `${seconds}s`,
                    },
                ],
            },
        },
        429,
    );

const textAnswer = (text: string) => json({ candidates: [{ content: { parts: [{ text }] } }] });

const audioAnswer = (bytes: number) =>
    json({
        candidates: [
            {
                content: {
                    parts: [
                        {
                            inlineData: {
                                mimeType: "audio/L16;codec=pcm;rate=24000",
                                data: Buffer.alloc(bytes).toString("base64"),
                            },
                        },
                    ],
                },
            },
        ],
    });

const modelOf = (url: string) => /models\/([^:]+):/.exec(url)?.[1];

test("a tutor model out of quota hands over to the next, and is skipped until Google says it resets", async (t) => {
    t.mock.method(console, "warn", () => undefined);
    let clock = 0;
    const calls = fakeFetch(t, (url) =>
        url.includes("gemini-3.8-flash") ? outOfQuota(3600) : textAnswer("Which platform"),
    );
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: VOICES,
        now: () => clock,
    });

    assert.equal(await tutor.transcribe(TRANSCRIBE, 5_000), "Which platform");
    assert.equal(await tutor.transcribe(TRANSCRIBE, 5_000), "Which platform");
    assert.deepEqual(
        calls.map((call) => modelOf(call.url)),
        ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.7-flash"],
    );

    clock += 3_600_000;
    await tutor.transcribe(TRANSCRIBE, 5_000);
    assert.equal(modelOf(calls[3].url), "gemini-3.8-flash");
});

test("a tutor model that fails for any other reason does not hand over", async (t) => {
    const calls = fakeFetch(t, () => json({ error: { message: "Invalid argument" } }, 400));
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: VOICES,
    });
    await assert.rejects(
        tutor.transcribe(TRANSCRIBE, 5_000),
        /Gemini answered 400 Invalid argument/,
    );
    assert.equal(calls.length, 1);
});

test("when a voice is out of quota the whole reply moves to the next voice", async (t) => {
    t.mock.method(console, "warn", () => undefined);
    const calls = fakeFetch(t, (url) =>
        url.includes(VOICES[0]) ? outOfQuota(30_100) : audioAnswer(480),
    );
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: VOICES,
    });

    const reply = `${"क".repeat(70)}। ${"ख".repeat(70)}।`;
    const wav = await tutor.speak({ text: reply, language: "hi" }, 10_000);
    assert.equal(wav?.readUInt32LE(40), 960);
    assert.deepEqual(
        calls.map((call) => modelOf(call.url)),
        [VOICES[0], VOICES[0], VOICES[1], VOICES[1]],
    );

    // The next reply goes straight to the voice with quota left.
    calls.length = 0;
    await tutor.speak({ text: "नमस्ते।", language: "hi" }, 10_000);
    assert.deepEqual(
        calls.map((call) => modelOf(call.url)),
        [VOICES[1]],
    );
});

test("the voice is given the reply as a transcript to read, not as a message to answer", async (t) => {
    // Sent bare, a French reply saying "you will answer in English" was spoken
    // in English, and "tell me in English that you want to top up" was answered.
    const calls = fakeFetch(t, () => audioAnswer(480));
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: VOICES,
    });
    const reply = "Dites-moi en anglais que vous voulez recharger dix dollars.";
    await tutor.speak({ text: reply, language: "fr" }, 10_000);

    const sent = JSON.parse(calls[0].body).contents[0].parts[0].text as string;
    assert.equal(sent, readAloud(reply, VOICES[0]));
    assert.ok(sent.startsWith(READ_ALOUD));
    assert.ok(sent.endsWith(`TRANSCRIPT:\n${reply}`));
});

test("the 3.8 voices are sent the reply bare, and the older ones under the read-aloud instruction", async (t) => {
    // 3.8 Flash-Lite read the whole English instruction out before the reply,
    // turning five seconds of speech into twenty. The 3.8 voices take their
    // input as a script already.
    t.mock.method(console, "warn", () => undefined);
    const calls = fakeFetch(t, (url) =>
        modelOf(url)?.startsWith("gemini-3.8") ? outOfQuota(60) : audioAnswer(480),
    );
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: ["gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview"],
    });
    await tutor.speak({ text: "नमस्ते।", language: "hi" }, 10_000);

    const sent = Object.fromEntries(
        calls.map((call) => [modelOf(call.url), JSON.parse(call.body).contents[0].parts[0].text]),
    );
    assert.equal(sent["gemini-3.8-flash-lite-tts"], "नमस्ते।");
    assert.equal(sent["gemini-3.1-flash-tts-preview"], `${READ_ALOUD}\n\nTRANSCRIPT:\nनमस्ते।`);
    assert.equal(readAloud("Hi.", "gemini-3.8-flash-tts"), "Hi.");
    assert.ok(readAloud("Hi.", "gemini-2.5-pro-preview-tts").startsWith(READ_ALOUD));
});

test("the WAV file a 3.8 voice answers with is unpacked, not wrapped in a second header", async (t) => {
    const samples = Buffer.from([1, 0, 2, 0, 3, 0, 4, 0]);
    fakeFetch(t, () =>
        json({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                inlineData: {
                                    mimeType: "audio/wav",
                                    data: pcmToWav(samples, 24_000).toString("base64"),
                                },
                            },
                        ],
                    },
                },
            ],
        }),
    );
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: ["gemini-3.8-flash-lite-tts"],
    });
    const wav = await tutor.speak({ text: "नमस्ते।", language: "hi" }, 10_000);
    assert.deepEqual(wav, pcmToWav(samples, 24_000));
});

test("the bare PCM the older voices answer with is still wrapped once", async (t) => {
    const samples = Buffer.from([1, 0, 2, 0, 3, 0, 4, 0]);
    fakeFetch(t, () =>
        json({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                inlineData: {
                                    mimeType: "audio/L16;codec=pcm;rate=24000",
                                    data: samples.toString("base64"),
                                },
                            },
                        ],
                    },
                },
            ],
        }),
    );
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: VOICES,
    });
    const wav = await tutor.speak({ text: "नमस्ते।", language: "hi" }, 10_000);
    assert.deepEqual(wav, pcmToWav(samples, 24_000));
});

test("with every voice out of quota, speech fails with the quota error", async (t) => {
    t.mock.method(console, "warn", () => undefined);
    fakeFetch(t, () => outOfQuota(60));
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: VOICES,
    });
    await assert.rejects(tutor.speak({ text: "नमस्ते।", language: "hi" }, 10_000), QuotaError);
});

test("a voice that stalls gets the next one started alongside it, and the first to finish is used", async (t) => {
    const calls = fakeFetch(t, (url) =>
        url.includes(VOICES[0]) ? new Promise<Response>(() => undefined) : audioAnswer(480),
    );
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: VOICES,
        hedgeAfterMs: 20,
    });
    const wav = await tutor.speak({ text: "नमस्ते।", language: "hi" }, 10_000);
    assert.equal(wav?.readUInt32LE(40), 480);
    assert.deepEqual(
        calls.map((call) => modelOf(call.url)),
        [VOICES[0], VOICES[1]],
    );
});

test("Cloud Text-to-Speech signs in as the service account, reuses its token, and is tried first", async (t) => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const account = { clientEmail: "tutor@project.iam.gserviceaccount.com", privateKey };
    const calls = fakeFetch(t, (url) => {
        if (url === TOKEN_URL) return json({ access_token: "token-1", expires_in: 3600 });
        if (url === SYNTHESIZE_URL) {
            return json({ audioContent: pcmToWav(Buffer.alloc(480), 24_000).toString("base64") });
        }
        return outOfQuota(60);
    });
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: VOICES,
        cloudSpeech: { account, models: ["gemini-3.1-flash-tts-preview"] },
    });

    const wav = await tutor.speak({ text: "নমস্কার।", language: "bn" }, 10_000);
    await tutor.speak({ text: "নমস্কার।", language: "bn" }, 10_000);

    assert.equal(wav?.readUInt32LE(40), 480);
    assert.deepEqual(
        calls.map((call) => call.url),
        [TOKEN_URL, SYNTHESIZE_URL, SYNTHESIZE_URL],
    );
    assert.equal(calls[1].headers.get("authorization"), "Bearer token-1");
    const synthesis = JSON.parse(calls[1].body);
    // The reply goes in as the text, and the instruction to read it as written
    // goes in its own field, where it is never spoken.
    assert.deepEqual(synthesis.input, { text: "নমস্কার।", prompt: READ_ALOUD });
    assert.deepEqual(synthesis.voice, {
        languageCode: "bn-BD",
        name: "Sulafat",
        model_name: "gemini-3.1-flash-tts-preview",
    });

    const assertion = new URLSearchParams(calls[0].body).get("assertion") ?? "";
    const [header, claims, signature] = assertion.split(".");
    assert.ok(
        createVerify("RSA-SHA256")
            .update(`${header}.${claims}`)
            .verify(publicKey, signature, "base64url"),
    );
    const decoded = JSON.parse(Buffer.from(claims, "base64url").toString("utf8"));
    assert.equal(decoded.iss, account.clientEmail);
    assert.equal(decoded.aud, TOKEN_URL);
    assert.equal(decoded.scope, "https://www.googleapis.com/auth/cloud-platform");
});

test("speech credentials are read as JSON or base64, and anything else is refused without echoing it", () => {
    const key = {
        client_email: "tutor@project.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
    };
    const expected = { clientEmail: key.client_email, privateKey: key.private_key };
    assert.deepEqual(parseServiceAccount(JSON.stringify(key)), expected);
    assert.deepEqual(
        parseServiceAccount(Buffer.from(JSON.stringify(key)).toString("base64")),
        expected,
    );
    assert.throws(
        () => parseServiceAccount("not-a-key-value"),
        (error: Error) => !error.message.includes("not-a-key-value"),
    );
});

test("a long reply is voiced in at most three requests, split only between sentences", () => {
    const sentences = ["क", "ख", "ग", "घ", "ङ", "च"].map((letter) => `${letter.repeat(70)}।`);
    const chunks = speechChunks(sentences.join(" "));
    assert.equal(chunks.length, 3);
    assert.equal(chunks.join(" "), sentences.join(" "));
});

/** What a chunking says, with the spaces it may add or drop between sentences taken out. */
const spoken = (text: string) => text.replace(/\s+/g, "");

test("Burmese, Chinese and Thai replies are split into several requests too", () => {
    // Regression: only `।.?!` followed by a space ended a sentence, so a reply
    // in these scripts went to the voice whole and took several times as long.
    const burmese = Array.from({ length: 6 }, (_, i) => `${"မင်္ဂလာပါ".repeat(8)}${i}။`);
    const chinese = Array.from(
        { length: 6 },
        (_, i) => `${"你好请问去裕廊东的站台在哪里".repeat(4)}${i}。`,
    );
    const thai = Array.from(
        { length: 6 },
        (_, i) => `${"สวัสดีครับคุณจะไปที่ไหน".repeat(3)}${i}ค่ะ`,
    );
    for (const [name, text] of [
        ["Burmese, spaced", burmese.join(" ")],
        ["Burmese, unspaced", burmese.join("")],
        ["Chinese", chinese.join("")],
        ["Thai", thai.join(" ")],
    ] as const) {
        const chunks = speechChunks(text);
        assert.equal(chunks.length, 3, name);
        assert.equal(spoken(chunks.join("")), spoken(text), name);
    }
});

test("Thai is not split beside an English word, so a place name is voiced whole", () => {
    const clause = "คุณต้องการไป Jurong East ใช่ไหมครับ ช่วยบอกหน่อยได้ไหมว่าจะไปทางไหนดีครับผม";
    const chunks = speechChunks(Array.from({ length: 6 }, () => clause).join(" "));
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) assert.ok(!/Jurong$/.test(chunk) && !/^East/.test(chunk), chunk);
});

test("punctuation is never a request of its own", () => {
    const long = "你好请问去裕廊东的站台在哪里".repeat(5);
    for (const text of [`${long}真的吗？！${long}。`, `？${long}。`, `${long}！！！`]) {
        for (const chunk of speechChunks(text)) assert.match(chunk, /[\p{L}\p{N}]/u, text);
    }
});

test("Bengali, Hindi and English still split between sentences, and keep prices whole", () => {
    const bengali = Array.from({ length: 6 }, () => `${"আপনি কোন প্ল্যাটফর্মে যাবেন ".repeat(3)}।`);
    assert.equal(speechChunks(bengali.join(" ")).length, 3);
    const hindi = Array.from({ length: 6 }, () => `${"आप किस प्लेटफ़ॉर्म पर जाएँगे ".repeat(3)}?`);
    assert.equal(speechChunks(hindi.join(" ")).length, 3);

    const english =
        "The fare to Jurong East is $1.20 today, so please top up your card first. " +
        "Tap your card at the gate, then go down to platform B and wait there for me. " +
        "The train comes every 3.5 minutes, so you will not wait long at all, my friend.";
    const chunks = speechChunks(english);
    assert.equal(chunks.length, 3);
    assert.ok(chunks.some((chunk) => chunk.includes("$1.20")));
    assert.ok(chunks.some((chunk) => chunk.includes("3.5 minutes")));
    assert.equal(chunks.join(" "), english);
});

test("a voice that fails early leaves no hedge behind to start another early", async (t) => {
    // Regression: each voice set its own hedge timer. When the first failed
    // early, its timer still fired and started a third voice beside the second,
    // which had only just begun, and the second's timer then started a fourth.
    const voices = ["v-fails", "v-slow", "v-third", "v-fourth"];
    const started: { model: string; at: number }[] = [];
    const begin = Date.now();
    fakeFetch(t, (url) => {
        const model = modelOf(url) ?? url;
        started.push({ model, at: Date.now() - begin });
        if (model === "v-fails") {
            return new Promise<Response>((resolve) =>
                setTimeout(() => resolve(outOfQuota(60)), 60),
            );
        }
        if (model === "v-slow") {
            return new Promise<Response>((resolve) =>
                setTimeout(() => resolve(audioAnswer(480)), 150),
            );
        }
        return new Promise<Response>(() => undefined);
    });
    const tutor = createGeminiTutor({
        apiKey: "key",
        tutorModels: TEXT_MODELS,
        speechModels: voices,
        hedgeAfterMs: 100,
    });
    const wav = await tutor.speak({ text: "नमस्ते।", language: "hi" }, 10_000);
    assert.equal(wav?.readUInt32LE(40), 480);
    // The slow voice gets a full hedge interval of its own before the third
    // starts, and the fourth is never needed.
    assert.deepEqual(
        started.map((call) => call.model),
        ["v-fails", "v-slow", "v-third"],
    );
    const slow = started.find((call) => call.model === "v-slow")!;
    const third = started.find((call) => call.model === "v-third")!;
    assert.ok(
        third.at - slow.at >= 90,
        `third started ${third.at - slow.at} ms after the slow one`,
    );
});

test("model settings are comma-separated lists with backups by default", () => {
    const config = readConfig(BASE_ENV);
    assert.deepEqual(config.tutorModels, TEXT_MODELS);
    // Each 3.8 voice has a daily quota of its own, so they go first.
    assert.deepEqual(config.speechModels.slice(0, 3), [
        "gemini-3.8-flash-lite-tts",
        "gemini-3.8-flash-tts",
        "gemini-3.1-flash-tts-preview",
    ]);
    assert.equal(config.speechCredentials, undefined);
    assert.deepEqual(readConfig({ ...BASE_ENV, GEMINI_SPEECH_MODEL: " a, b ," }).speechModels, [
        "a",
        "b",
    ]);
});
