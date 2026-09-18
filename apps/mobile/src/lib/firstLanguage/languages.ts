/**
 * The languages a learner can name as the one they know best.
 *
 * This is not the app's locale list. The app is written in seven languages, but
 * a learner holding a finger on an English word wants that word in whatever
 * they actually grew up speaking, which on a Singapore worksite is a wider set.
 * English is missing on purpose: there would be nothing to translate to.
 *
 * Codes keep the app's historical locale codes where one exists, so a learner
 * running the app in Burmese and reading Burmese in the bubble sees one code in
 * both places.
 */

import { getLocales } from "expo-localization";

import { getLocale } from "@/lib/i18n";

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

/** What each language calls itself. A learner finds their own name fastest. */
export const FIRST_LANGUAGE_LABELS: Record<FirstLanguage, string> = {
    bn: "বাংলা",
    ta: "தமிழ்",
    hi: "हिन्दी",
    te: "తెలుగు",
    ml: "മലയാളം",
    bu: "မြန်မာ",
    fi: "Filipino",
    in: "Bahasa Indonesia",
    ms: "Bahasa Melayu",
    zh: "中文",
    th: "ไทย",
    vi: "Tiếng Việt",
};

/** For English copy, logs and the account screen's secondary line. */
export const FIRST_LANGUAGE_ENGLISH_NAMES: Record<FirstLanguage, string> = {
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

export function isFirstLanguage(value: unknown): value is FirstLanguage {
    return typeof value === "string" && (FIRST_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Device language tags that mean one of ours under another name.
 *
 * Android and iOS report Burmese as "my" and Filipino as "fil" or "tl", while
 * our codes for those are "bu" and "fi" (see the locale list in lib/i18n).
 * Indonesian is "id" on modern devices and "in" on older ones, and "in" is also
 * our own code for it. The device's "fi" is deliberately absent: on a phone
 * that tag is Finnish, and offering a Finn Filipino would be worse than
 * offering nothing.
 */
const DEVICE_LANGUAGES: Record<string, FirstLanguage> = {
    bn: "bn",
    ta: "ta",
    hi: "hi",
    te: "te",
    ml: "ml",
    my: "bu",
    bu: "bu",
    fil: "fi",
    tl: "fi",
    id: "in",
    in: "in",
    ms: "ms",
    zh: "zh",
    th: "th",
    vi: "vi",
};

function fromDeviceTag(tag: string | null | undefined): FirstLanguage | null {
    if (!tag) return null;
    const lower = tag.toLowerCase();
    // Every Chinese tag means the same bubble to us: we translate into
    // Simplified and do not ask a learner to pick a script.
    if (lower === "zh" || lower.startsWith("zh-")) return "zh";
    const base = lower.split(/[-_]/)[0];
    return DEVICE_LANGUAGES[base] ?? null;
}

/**
 * Best guess to pre-select on the onboarding screen; null when there is none.
 *
 * The app's own locale comes first: a learner who already switched the app to
 * Tamil has told us something deliberate. Failing that we read the phone's
 * language list, which is usually right and costs the learner nothing when it
 * is not, since the screen still asks.
 */
export function suggestFirstLanguage(): FirstLanguage | null {
    const locale = getLocale();
    if (locale !== "en" && isFirstLanguage(locale)) return locale;
    try {
        for (const device of getLocales()) {
            const match = fromDeviceTag(device.languageCode) ?? fromDeviceTag(device.languageTag);
            if (match) return match;
        }
    } catch {
        // A device that will not say what language it is in is not a reason to
        // fail the onboarding screen; it just gets no pre-selection.
    }
    return null;
}
