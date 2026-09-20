/**
 * The lessons' own words, as a dictionary on the phone.
 *
 * Every lesson already teaches its vocabulary and sentences in Bengali, Tamil
 * and Hindi, written by the people who wrote the lesson. So the first place to
 * look for a held word is the lesson content itself: it answers instantly, it
 * answers with no connection, and it answers better than a model would, because
 * "alight" here means what it means on an MRT platform and nothing else.
 *
 * The index is built the first time a word is held rather than at import, so
 * the cost lands on a learner who is already waiting for a bubble instead of on
 * everybody's app launch.
 */

import { listLessons } from "@/lib/lessons/data";
import { hasTranslation, localized } from "@/lib/lessons/localized";
import type { LearnerLanguage, Localized } from "@/lib/lessons/types";
import type { TranslationLanguage } from "@/lib/firstLanguage/languages";

import type { WordTranslation } from "./lookup";

/** An expression the lessons teach: a multi-word term, or a whole sentence. */
type Expression = { text: string; words: string[]; meaning: Localized };

type Glossary = {
    /** Lower-cased single words to what the lesson says they mean. */
    terms: Map<string, Localized>;
    expressions: Expression[];
};

let glossary: Glossary | null = null;

/**
 * Lesson content is authored in English, Bengali, Tamil and Hindi only, and the
 * learner may have named any of twelve languages. Listed here rather than
 * derived, for the same reason `lessons/localized` lists it: adding a language
 * to the lessons should be one deliberate edit.
 */
function authored(
    language: TranslationLanguage,
): language is Extract<LearnerLanguage, TranslationLanguage> {
    return language === "bn" || language === "ta" || language === "hi";
}

/**
 * The words of a piece of English, lower-cased.
 *
 * Punctuation becomes a gap, so "Jurong East?" and "jurong east" are the same
 * two words, while an apostrophe or a hyphen stays inside the word it belongs
 * to ("don't", "7-eleven").
 */
function wordsOf(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9'’-]+/g, " ")
        .split(" ")
        .filter(Boolean);
}

function build(): Glossary {
    const terms = new Map<string, Localized>();
    const expressions: Expression[] = [];
    const add = (text: string, meaning: Localized) => {
        const words = wordsOf(text);
        if (words.length === 0) return;
        if (words.length === 1) {
            // First lesson to teach a word wins. The catalogue is ordered the
            // way a learner takes it, so that is the meaning they met first.
            if (!terms.has(words[0])) terms.set(words[0], meaning);
            return;
        }
        expressions.push({ text, words, meaning });
    };
    for (const lesson of listLessons()) {
        for (const item of lesson.vocab) add(item.term, item.meaning);
        for (const phrase of lesson.phrases) add(phrase.text, phrase.meaning);
    }
    return { terms, expressions };
}

function index(): Glossary {
    glossary ??= build();
    return glossary;
}

/** Does `needle` appear in `haystack` as whole words, in that order? */
function containsRun(haystack: string[], needle: string[]): boolean {
    return ` ${haystack.join(" ")} `.includes(` ${needle.join(" ")} `);
}

/**
 * What the lessons say this single word means, or null.
 *
 * A trailing "s" is forgiven only when the singular is itself a taught word, so
 * "fares" finds "fare" while "less" is never mistaken for a plural of "les".
 */
function meaningOf(
    word: string,
    language: Extract<LearnerLanguage, TranslationLanguage>,
): string | null {
    const { terms } = index();
    const direct = terms.get(word);
    const singular = !direct && word.length > 2 && word.endsWith("s") ? word.slice(0, -1) : null;
    const meaning = direct ?? (singular ? terms.get(singular) : undefined);
    // Never the English fallback: showing a learner English in the place their
    // own language belongs is worse than showing them nothing, because they
    // asked precisely because they could not read the English.
    if (!meaning || !hasTranslation(meaning, language)) return null;
    return localized(meaning, language);
}

/**
 * The shortest taught expression that is in this sentence and contains this
 * word, or null.
 *
 * Shortest because both "top up" and "I want to top up ten dollars." can match,
 * and "top up" is the one that explains why "top" alone was not the answer.
 */
function expressionAround(
    word: string,
    context: string,
    language: Extract<LearnerLanguage, TranslationLanguage>,
): { text: string; translation: string } | null {
    const sentence = wordsOf(context);
    if (sentence.length === 0) return null;
    const singular = word.length > 2 && word.endsWith("s") ? word.slice(0, -1) : null;
    let best: Expression | null = null;
    for (const expression of index().expressions) {
        if (
            !expression.words.includes(word) &&
            !(singular && expression.words.includes(singular))
        ) {
            continue;
        }
        if (!containsRun(sentence, expression.words)) continue;
        if (!hasTranslation(expression.meaning, language)) continue;
        if (!best || expression.words.length < best.words.length) best = expression;
    }
    if (!best) return null;
    return { text: best.text, translation: localized(best.meaning, language) };
}

/**
 * A held word answered from the lessons, or null to let the network try.
 *
 * When the word sits inside a taught expression, the expression is handed back
 * alongside it. If the expression is all we know, the answer is null: a bubble
 * that explains "top up" without saying what "top" means is not what the
 * learner asked for, and the server can do better.
 */
export function lookupGlossary(
    word: string,
    context: string,
    language: TranslationLanguage,
): WordTranslation | null {
    if (!authored(language)) return null;
    const held = wordsOf(word)[0];
    if (!held) return null;

    const translation = meaningOf(held, language);
    const phrase = expressionAround(held, context, language);
    if (phrase && !translation) return null;
    if (!translation) return null;
    return { word, translation, phrase, source: "glossary" };
}

/** Test seam: build the index again, for a test that changes the lessons. */
export function resetGlossaryForTests() {
    glossary = null;
}
