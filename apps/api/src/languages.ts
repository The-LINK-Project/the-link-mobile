/**
 * The languages a learner can name as the one they know best.
 *
 * This is not the app's locale list. The app is written in seven languages, but
 * a learner holding a finger on an English word wants that word in whatever
 * they actually grew up speaking, which on a Singapore worksite is a wider set.
 * English is missing on purpose: there would be nothing to translate to.
 *
 * Codes keep the app's historical locale codes where one exists, so the same
 * code means the same language on the phone and here. The list and its order
 * are the contract in docs/FIRST-LANGUAGE.md; the mobile copy is
 * `apps/mobile/src/lib/firstLanguage/languages.ts`.
 */

export const FIRST_LANGUAGES = [
    "bn",
    "ta",
    "hi",
    "te",
    "ml",
    "bu",
    "fi",
    "in",
    "ms",
    "zh",
    "th",
    "vi",
] as const;

export type FirstLanguage = (typeof FIRST_LANGUAGES)[number];

/** For the model's instructions and for logs. The learner never sees these. */
export const FIRST_LANGUAGE_NAMES: Record<FirstLanguage, string> = {
    bn: "Bengali",
    ta: "Tamil",
    hi: "Hindi",
    te: "Telugu",
    ml: "Malayalam",
    bu: "Burmese",
    fi: "Filipino",
    in: "Indonesian",
    ms: "Malay",
    zh: "Chinese (Simplified)",
    th: "Thai",
    vi: "Vietnamese",
};

/**
 * The Unicode script a translation into this language must be written in, as
 * the name `\p{Script=...}` knows it. Null where the language is written in
 * Latin letters, because there a reply in Latin letters proves nothing.
 *
 * This is what lets the server check a translation instead of trusting it: a
 * model that answers in English, or romanises the word, is caught in code.
 */
export const FIRST_LANGUAGE_SCRIPTS: Record<FirstLanguage, string | null> = {
    bn: "Bengali",
    ta: "Tamil",
    hi: "Devanagari",
    te: "Telugu",
    ml: "Malayalam",
    bu: "Myanmar",
    fi: null,
    in: null,
    ms: null,
    zh: "Han",
    th: "Thai",
    vi: null,
};

export function isFirstLanguage(value: unknown): value is FirstLanguage {
    return typeof value === "string" && (FIRST_LANGUAGES as readonly string[]).includes(value);
}
