/**
 * Live check of the Gemini tutor: real models, no Clerk or MongoDB.
 *
 * The unit tests fake the model, so they cannot catch a renamed field or model
 * id. This runs the opening turn, then has the voice model say the first
 * sentence and sends that back as the learner's recording. Both tutor lines are
 * saved so you can hear how Bengali and English sound together in one clip.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

import { readConfig } from "../src/config.js";
import { tutorFromConfig } from "../src/gemini.js";
import { allowedWords, findViolations, parseTurnRequest, runTurn } from "../src/tutor.js";
import { mrtContext } from "./tutor-fixture.js";

const config = readConfig();
assert.ok(config.geminiApiKey, "Set GEMINI_API_KEY in apps/api/.env");
// Built the way the server builds it, so Cloud Text-to-Speech is checked too when configured.
const tutor = tutorFromConfig({ ...config, geminiApiKey: config.geminiApiKey });

const context = mrtContext("bn");
const allowed = allowedWords(context);

function turn(body: object) {
    const parsed = parseTurnRequest({ ...context, ...body });
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.value;
}

mkdirSync("artifacts", { recursive: true });

const opening = await runTurn(turn({ goalIndex: 0, attempt: 1, history: [] }), tutor);
console.log("Tutor:", opening.reply);
assert.deepEqual(findViolations(opening.reply, allowed), []);
assert.ok(opening.audio, "The speech model returned no audio");
writeFileSync("artifacts/tutor-opening.wav", Buffer.from(opening.audio.data, "base64"));

const learner = await tutor.speak(
    { text: "Which platform for Jurong East?", language: "bn" },
    30_000,
);
assert.ok(learner, "The speech model returned no audio for the learner's line");
const answer = await runTurn(
    turn({
        goalIndex: 0,
        attempt: 1,
        history: [{ role: "tutor", text: opening.reply }],
        audio: { mimeType: "audio/wav", data: learner.toString("base64") },
    }),
    tutor,
);
console.log("Heard:", answer.heard);
console.log("Outcome:", answer.outcome);
console.log("Tutor:", answer.reply);
assert.equal(answer.outcome, "met");
assert.deepEqual(findViolations(answer.reply, allowed), []);
if (answer.audio) {
    writeFileSync("artifacts/tutor-reply.wav", Buffer.from(answer.audio.data, "base64"));
}

console.log(
    "Live Gemini tutor smoke test passed. Listen to apps/api/artifacts/tutor-opening.wav and tutor-reply.wav.",
);
