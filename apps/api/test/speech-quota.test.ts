import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";

import { parseServiceAccount } from "../src/cloud-speech.js";
import { readConfig } from "../src/config.js";
import { createGeminiTutor, pcmToWav, speechChunks } from "../src/gemini.js";
import { QuotaError } from "../src/google.js";

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
    assert.equal(synthesis.input.text, "নমস্কার।");
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

test("model settings are comma-separated lists with backups by default", () => {
    const config = readConfig(BASE_ENV);
    assert.deepEqual(config.tutorModels, TEXT_MODELS);
    assert.ok(config.speechModels.length > 1);
    assert.equal(config.speechCredentials, undefined);
    assert.deepEqual(readConfig({ ...BASE_ENV, GEMINI_SPEECH_MODEL: " a, b ," }).speechModels, [
        "a",
        "b",
    ]);
});
