import { getLocale, useLocale, type Locale } from "@/lib/i18n";

import type { Localized } from "./types";

/**
 * Resolve lesson content into one language.
 *
 * Lesson content is authored in English, Bengali and Tamil. The app ships six
 * locales, so anything else falls back to English rather than showing an empty
 * string — the same policy `lib/i18n` uses for UI copy.
 *
 * Pure, and takes the locale explicitly. Components should use `useLocalized`
 * instead; this form is for grading, tests and anything outside React.
 */
export function localized(value: Localized, locale: Locale): string {
    if (locale === "bn" || locale === "ta") {
        const translated = value[locale];
        if (translated) return translated;
    }
    return value.en;
}

/**
 * Resolver bound to the current locale, which re-renders on a language change.
 *
 * Components must use this rather than calling `localized` with
 * `getLocale()`. Reading the locale at call time gives the right answer once
 * and then goes stale: nothing tells React to render again when the learner
 * switches language, so a screen that shows only lesson content stays in the
 * old language until something unrelated happens to re-render it. That was a
 * real bug in the matching exercise, which had no other reason to re-render.
 */
export function useLocalized() {
    const [locale] = useLocale();
    return (value: Localized) => localized(value, locale);
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
export function hasTranslation(value: Localized, locale: Locale): boolean {
    if (locale === "bn" || locale === "ta") return Boolean(value[locale]);
    // English is the fallback, so it is never a translation of itself.
    return false;
}

/** The current locale, for the rare non-React caller that needs it. */
export function currentLocale(): Locale {
    return getLocale();
}
