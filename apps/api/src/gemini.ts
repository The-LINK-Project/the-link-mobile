import type { TutorModel } from "./tutor.js";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const VOICE = "Sulafat";
/** Gemini speech is raw 16-bit mono PCM; the rate is read from the response when present. */
const DEFAULT_SAMPLE_RATE = 24_000;

export class GeminiError extends Error {}

type Part = { text?: string; thought?: boolean; inlineData?: { mimeType?: string; data?: string } };
type GenerateResponse = {
    candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
};

const DRAFT_SCHEMA = {
    type: "object",
    properties: {
        heard: { type: "string", description: "What the learner said, in the scripts they used." },
        understood: { type: "boolean" },
        attempted: {
            type: "boolean",
            description: "False when the learner asked a question or talked about something else.",
        },
        goalMet: { type: "boolean" },
        reply: { type: "string", description: "What the teacher says next." },
    },
    required: ["heard", "understood", "attempted", "goalMet", "reply"],
};

const REWRITE_SCHEMA = {
    type: "object",
    properties: { reply: { type: "string" } },
    required: ["reply"],
};

async function generate(
    apiKey: string,
    model: string,
    body: unknown,
    timeoutMs: number,
): Promise<GenerateResponse> {
    let response: Response;
    try {
        response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
        });
    } catch (error) {
        const timedOut = (error as Error).name === "TimeoutError";
        throw new GeminiError(timedOut ? "Gemini timed out" : "Could not reach Gemini");
    }

    if (!response.ok) {
        // Google's error text names the problem (a bad key, an unknown field)
        // without echoing the request, so it is safe to log and worth keeping.
        const detail = await response
            .json()
            .then((json: { error?: { message?: string } }) => json.error?.message ?? "")
            .catch(() => "");
        throw new GeminiError(`Gemini answered ${response.status} ${detail}`.trim().slice(0, 300));
    }

    try {
        return (await response.json()) as GenerateResponse;
    } catch {
        throw new GeminiError("Gemini returned an unreadable response");
    }
}

function parts(response: GenerateResponse): Part[] {
    return response.candidates?.[0]?.content?.parts ?? [];
}

function jsonOutput(response: GenerateResponse): Record<string, unknown> {
    const text = parts(response)
        .filter((part) => typeof part.text === "string" && !part.thought)
        .map((part) => part.text)
        .join("");
    if (!text) {
        const reason =
            response.promptFeedback?.blockReason ?? response.candidates?.[0]?.finishReason;
        throw new GeminiError(`Gemini returned no text (${reason ?? "empty"})`);
    }
    try {
        const value: unknown = JSON.parse(text);
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            return value as Record<string, unknown>;
        }
    } catch {
        // Reported below.
    }
    throw new GeminiError("Gemini returned malformed JSON");
}

export function pcmToWav(pcm: Buffer, sampleRate = DEFAULT_SAMPLE_RATE): Buffer {
    const channels = 1;
    const bitsPerSample = 16;
    const blockAlign = (channels * bitsPerSample) / 8;
    const header = Buffer.alloc(44);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write("WAVE", 8, "ascii");
    header.write("fmt ", 12, "ascii");
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * blockAlign, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36, "ascii");
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
}

function sampleRateOf(mimeType: string | undefined): number {
    const rate = Number(/rate=(\d+)/.exec(mimeType ?? "")?.[1]);
    return Number.isInteger(rate) && rate > 0 ? rate : DEFAULT_SAMPLE_RATE;
}

export function createGeminiTutor(options: {
    apiKey: string;
    tutorModel: string;
    speechModel: string;
}): TutorModel {
    const jsonConfig = (schema: object) => ({
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        // The lowest level Pro allows; it cannot switch thinking off. Judging one
        // short recording needs little reasoning, and every second of it is a
        // second the learner waits.
        thinkingConfig: { thinkingLevel: "LOW" },
    });

    return {
        async draft({ system, prompt, audio }, timeoutMs) {
            const content = audio
                ? [{ inlineData: { mimeType: audio.mimeType, data: audio.data } }, { text: prompt }]
                : [{ text: prompt }];
            const json = jsonOutput(
                await generate(
                    options.apiKey,
                    options.tutorModel,
                    {
                        systemInstruction: { parts: [{ text: system }] },
                        contents: [{ role: "user", parts: content }],
                        generationConfig: jsonConfig(DRAFT_SCHEMA),
                    },
                    timeoutMs,
                ),
            );
            const { heard, understood, attempted, goalMet, reply } = json;
            if (
                typeof heard !== "string" ||
                typeof understood !== "boolean" ||
                typeof attempted !== "boolean" ||
                typeof goalMet !== "boolean" ||
                typeof reply !== "string"
            ) {
                throw new GeminiError("Gemini returned an unexpected shape");
            }
            return { heard, understood, attempted, goalMet, reply };
        },

        async rewrite({ system, prompt }, timeoutMs) {
            const json = jsonOutput(
                await generate(
                    options.apiKey,
                    options.tutorModel,
                    {
                        systemInstruction: { parts: [{ text: system }] },
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: jsonConfig(REWRITE_SCHEMA),
                    },
                    timeoutMs,
                ),
            );
            if (typeof json.reply !== "string") {
                throw new GeminiError("Gemini returned an unexpected shape");
            }
            return json.reply;
        },

        async speak(text, timeoutMs) {
            const pieces = await Promise.all(
                speechChunks(text).map((chunk) =>
                    speakChunk(options.apiKey, options.speechModel, chunk, timeoutMs),
                ),
            );
            const spoken = pieces.filter((piece): piece is Spoken => piece !== null);
            // A reply missing a sentence would say something other than the checked text.
            if (spoken.length === 0 || spoken.length < pieces.length) return null;
            return pcmToWav(Buffer.concat(spoken.map((piece) => piece.pcm)), spoken[0].rate);
        },
    };
}

const SENTENCE_END = /(?<=[।.?!])\s+/;
/** A shorter sentence joins the next one, so a greeting is not a request of its own. */
const MIN_CHUNK_LENGTH = 60;

/**
 * A reply split into whole sentences for speech.
 *
 * The voice model takes roughly as long as the audio it makes: a 24-second
 * opening took 18 seconds as one request and 8 seconds as six sentences at
 * once. Splitting only between sentences keeps the joins where a pause belongs.
 */
export function speechChunks(text: string): string[] {
    const chunks: string[] = [];
    for (const sentence of text.split(SENTENCE_END)) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;
        const last = chunks.length - 1;
        if (last >= 0 && chunks[last].length < MIN_CHUNK_LENGTH) chunks[last] += ` ${trimmed}`;
        else chunks.push(trimmed);
    }
    return chunks;
}

type Spoken = { pcm: Buffer; rate: number };

async function speakChunk(
    apiKey: string,
    model: string,
    text: string,
    timeoutMs: number,
): Promise<Spoken | null> {
    // Only checked text is sent. A spoken style instruction would be English the
    // word rule never saw, and the voice model occasionally reads instructions aloud.
    const response = await generate(
        apiKey,
        model,
        {
            contents: [{ role: "user", parts: [{ text }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
            },
        },
        timeoutMs,
    );
    const inline = parts(response).find((part) => part.inlineData?.data)?.inlineData;
    if (!inline?.data) return null;
    const pcm = Buffer.from(inline.data, "base64");
    return pcm.length > 0 ? { pcm, rate: sampleRateOf(inline.mimeType) } : null;
}
