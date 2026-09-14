/**
 * How well the tutor judges real learners' recordings.
 *
 * Published benchmarks measure open transcription for Indian speakers. This app
 * needs something narrower: deciding whether a Bangladeshi or Tamil worker with
 * a strong accent said a known English sentence. Only their own recordings can
 * show that, so this runs a folder of labelled clips through each model and
 * counts both kinds of mistake: a correct answer rejected, and a wrong answer
 * accepted because the model knew what it expected to hear.
 *
 * Clips go in artifacts/eval (git-ignored), named <goal>.<said|missed>.<name>.<ext>.
 * Use only recordings from people who agreed to it, and delete them afterwards.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

import { readConfig } from "../src/config.js";
import { createGeminiTutor } from "../src/gemini.js";
import {
    allowedWords,
    readTranscript,
    systemInstruction,
    TRANSCRIBE_PROMPT,
    transcriptionInstruction,
    turnPrompt,
    type TurnRequest,
} from "../src/tutor.js";
import { mrtContext } from "./tutor-fixture.js";

const DIRECTORY = "artifacts/eval";
const MIME_TYPES: Record<string, string> = {
    ".wav": "audio/wav",
    ".m4a": "audio/m4a",
    ".mp3": "audio/mp3",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
};

const config = readConfig();
assert.ok(config.geminiApiKey, "Set GEMINI_API_KEY in apps/api/.env");
const apiKey = config.geminiApiKey;
const models = (process.env.EVAL_MODELS ?? config.tutorModels.join(","))
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
const context = mrtContext(process.env.EVAL_LANGUAGE === "ta" ? "ta" : "bn");
const goalIds = context.goals.map((goal) => goal.id);

let files: string[];
try {
    files = readdirSync(DIRECTORY).filter((file) => !file.startsWith("."));
} catch {
    console.log(
        `Put recordings in apps/api/${DIRECTORY}, named <goal>.<said|missed>.<name>.<ext>.`,
    );
    console.log(`Goals: ${goalIds.join(", ")}.`);
    process.exit(1);
}

const clips = files.flatMap((file) => {
    const [goalId, label] = file.split(".");
    const mimeType = MIME_TYPES[extname(file).toLowerCase()];
    const goalIndex = goalIds.indexOf(goalId);
    if (!mimeType || goalIndex === -1 || (label !== "said" && label !== "missed")) {
        console.warn(`Skipping ${file}: expected <goal>.<said|missed>.<name>.<ext>`);
        return [];
    }
    const data = readFileSync(join(DIRECTORY, file)).toString("base64");
    return [{ file, goalIndex, expected: label === "said", audio: { mimeType, data } }];
});
assert.ok(clips.length > 0, "No usable recordings found");

for (const model of models) {
    const tutor = createGeminiTutor({
        apiKey,
        tutorModels: [model],
        speechModels: config.speechModels,
    });
    let rejectedCorrect = 0;
    let acceptedWrong = 0;
    let failed = 0;
    const timings: number[] = [];

    console.log(`\n${model}`);
    for (const clip of clips) {
        const request: TurnRequest = {
            ...context,
            goalIndex: clip.goalIndex,
            attempt: 1,
            asides: 0,
            history: [],
            audio: clip.audio,
        };
        const started = Date.now();
        try {
            // The same two steps as a real turn: write the recording down without
            // the lesson, then judge those words against the goal.
            const heard = readTranscript(
                await tutor.transcribe(
                    {
                        system: transcriptionInstruction(request.language),
                        prompt: TRANSCRIBE_PROMPT,
                        audio: clip.audio,
                    },
                    20_000,
                ),
            );
            const draft = await tutor.draft(
                {
                    system: systemInstruction(request, allowedWords(request)),
                    prompt: turnPrompt(request, heard),
                },
                60_000,
            );
            const elapsed = Date.now() - started;
            timings.push(elapsed);
            const judged = heard !== "" && draft.goalMet;
            if (clip.expected && !judged) rejectedCorrect++;
            if (!clip.expected && judged) acceptedWrong++;
            const verdict = judged === clip.expected ? "ok   " : "WRONG";
            console.log(
                `  ${verdict} ${clip.file}  expected ${clip.expected ? "said" : "missed"}, judged ${judged ? "said" : "missed"}  ${elapsed}ms  heard: ${heard || "(nothing)"}`,
            );
        } catch (error) {
            failed++;
            console.log(`  ERROR ${clip.file}  ${(error as Error).message}`);
        }
    }

    timings.sort((a, b) => a - b);
    const judgedCount = clips.length - failed;
    const correct = judgedCount - rejectedCorrect - acceptedWrong;
    console.log(
        `  ${correct}/${judgedCount} right; rejected ${rejectedCorrect} correct answers; accepted ${acceptedWrong} wrong answers; ${failed} errors; median ${timings[Math.floor(timings.length / 2)] ?? 0}ms`,
    );
}
