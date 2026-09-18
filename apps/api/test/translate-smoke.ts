/**
 * Live check of word translation: a real model, no Clerk or MongoDB.
 *
 * The unit tests fake the model, so they cannot catch a renamed field, a model
 * id that no longer exists, or a model that answers in the wrong script. This
 * holds one word in one sentence in four languages, and two words that belong
 * to phrasal verbs, and prints what came back for a reader of those languages
 * to judge.
 */
import assert from "node:assert/strict";

import { readConfig } from "../src/config.js";
import { createGeminiTranslator } from "../src/gemini.js";
import { FIRST_LANGUAGE_NAMES, type FirstLanguage } from "../src/languages.js";
import {
    checkTranslation,
    parseTranslateRequest,
    TRANSLATE_BUDGET_MS,
    type TranslationRequest,
} from "../src/translate.js";

const SENTENCE = "Find the right platform, top up your card, and get off at the right stop.";

const config = readConfig();
assert.ok(config.geminiApiKey, "Set GEMINI_API_KEY in apps/api/.env");
const translator = createGeminiTranslator({
    apiKey: config.geminiApiKey,
    models: config.translateModels,
});
console.log("Models:", config.translateModels.join(", "));
console.log("Sentence:", SENTENCE);

function request(word: string, language: FirstLanguage): TranslationRequest {
    const parsed = parseTranslateRequest({ word, context: SENTENCE, language });
    if (!parsed.ok) throw new Error(parsed.error);
    assert.equal(parsed.value.context, SENTENCE, "the sentence should carry the word");
    return parsed.value;
}

const asked: [string, FirstLanguage][] = [
    ["platform", "bn"],
    ["platform", "ta"],
    ["platform", "zh"],
    ["platform", "fi"],
    ["top", "bn"],
    ["off", "bn"],
];

for (const [word, language] of asked) {
    const input = request(word, language);
    const started = Date.now();
    const draft = await translator.translate(input, TRANSLATE_BUDGET_MS);
    const checked = checkTranslation(draft, input);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    assert.ok(checked, `${language} "${word}" did not pass the checks: ${JSON.stringify(draft)}`);
    const phrase = checked.phrase
        ? `"${checked.phrase.text}" = ${checked.phrase.translation}`
        : "none";
    console.log(
        `${FIRST_LANGUAGE_NAMES[language]} "${word}" -> ${checked.translation}   phrase: ${phrase}   (${seconds}s${draft.phrase && !checked.phrase ? ", the model's phrase was dropped" : ""})`,
    );
}

console.log("Live translation smoke test passed.");
