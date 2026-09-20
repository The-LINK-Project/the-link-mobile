import { useLocale, type Locale } from "@/lib/i18n";
import type { FirstLanguage } from "@/lib/firstLanguage/languages";
import { useFirstLanguage } from "@/lib/firstLanguage/store";

import type { LearnerLanguage, Localized } from "./types";

/**
 * Languages lesson content is translated into. Listed rather than derived, so
 * adding one is a deliberate edit in one place.
 */
function isTranslated(language: string): language is Exclude<LearnerLanguage, "en"> {
    return language === "bn" || language === "ta" || language === "hi";
}

/**
 * Resolve lesson content into one language.
 *
 * Lesson content is authored in English, Bengali, Tamil and Hindi. The app ships six
 * locales, so anything else falls back to English rather than showing an empty
 * string — the same policy `lib/i18n` uses for UI copy.
 *
 * Pure, and takes the locale explicitly. Components should use
 * `useFirstLanguageLocalized` instead; this form is for grading, tests and anything outside React.
 */
export function localized(
    value: Localized,
    language: Locale | LearnerLanguage | FirstLanguage,
): string {
    if (isTranslated(language)) {
        const translated = value[language];
        if (translated) return translated;
    }
    return value.en;
}

/**
 * Resolve explanations and directions in the language the learner said they
 * know best. This is deliberately separate from the app locale: English is
 * the subject of the lesson, while the first language is what explains it.
 *
 * Components must use this rather than calling `localized` with a language
 * read at call time. That gives the right answer once and then goes stale:
 * nothing tells React to render again when the learner switches language. That
 * was a real bug in the matching exercise, which had no other reason to
 * re-render.
 */
export function useFirstLanguageLocalized() {
    const [firstLanguage] = useFirstLanguage();
    const [locale] = useLocale();
    const language = firstLanguage ?? locale;
    return (value: Localized) => localized(value, language);
}

/**
 * Is this content actually written in the learner's language?
 *
 * Distinct from `localized`, which always returns something: for a language
 * with no content authored it returns the English fallback. Callers that need
 * to know whether real translated words exist — deciding whether a translation
 * exercise can teach anything, for instance — must ask this instead of
 * comparing strings.
 *
 * The supported set is narrower than the app's locale list, and is listed here
 * rather than derived, so adding a language is a deliberate edit in one place.
 */
export function hasTranslation(
    value: Localized,
    language: Locale | LearnerLanguage | FirstLanguage,
): boolean {
    // English is the fallback, so it is never a translation of itself.
    return isTranslated(language) && Boolean(value[language]);
}
