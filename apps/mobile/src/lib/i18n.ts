// Mobile-owned translation catalogues. The initial shared About/auth/account
// copy was carried over deliberately, but these files no longer depend on the
// website repository. New foundation copy is written in English first and
// falls back to English in the other catalogues until the team translates it.
//
// Locale choice is persisted on the device; first launch follows the phone's
// language when it is one we ship, else English.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { I18n } from "i18n-js";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import bn from "@/messages/bn.json";
import bu from "@/messages/bu.json";
import en from "@/messages/en.json";
import fi from "@/messages/fi.json";
import id from "@/messages/in.json";
import ta from "@/messages/ta.json";

// Same codes as i18n/routing.ts on the web ("in" is Bahasa Indonesia, "bu"
// Burmese, "fi" Filipino — historical codes, kept for parity with the site).
export const LOCALES = ["en", "bn", "ta", "bu", "fi", "in"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

// Our historical locale codes → real BCP 47 tags, for Intl APIs like
// toLocaleDateString ("bu" is Burmese = my, "fi" is Filipino = fil,
// "in" is Bahasa Indonesia = id)
export const BCP47: Record<Locale, string> = {
    en: "en",
    bn: "bn",
    ta: "ta",
    bu: "my",
    fi: "fil",
    in: "id",
};

export const LOCALE_LABELS: Record<Locale, string> = {
    en: "English",
    bn: "বাংলা",
    ta: "தமிழ்",
    bu: "မြန်မာ",
    fi: "Filipino",
    in: "Bahasa Indonesia",
};

const STORAGE_KEY = "link.locale";

const i18n = new I18n({ en, bn, ta, bu, fi, in: id });
// A key missing from one catalogue falls back to English rather than showing
// a "[missing translation]" marker
i18n.enableFallback = true;
i18n.defaultLocale = DEFAULT_LOCALE;
i18n.locale = DEFAULT_LOCALE;
// Accept next-intl's ICU-style `{name}` (what the shared catalogues use) as
// well as i18n-js's own `{{name}}` / `%{name}`
i18n.placeholder = /\{\{?(.*?)\}?\}/gm;

// Map a device language tag to one of ours. Burmese is "my" and Filipino
// "fil"/"tl" on the device but "bu"/"fi" in our catalogues.
function detectDeviceLocale(): Locale {
    const tag = getLocales()[0]?.languageCode?.toLowerCase();
    switch (tag) {
        case "bn":
            return "bn";
        case "ta":
            return "ta";
        case "my":
            return "bu";
        case "fil":
        case "tl":
            return "fi";
        case "id":
        case "in":
            return "in";
        default:
            return DEFAULT_LOCALE;
    }
}

// Tiny external store so every screen re-renders when the locale changes
let currentLocale: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

function setLocaleInternal(locale: Locale) {
    currentLocale = locale;
    i18n.locale = locale;
    listeners.forEach((listener) => listener());
}

/** Loads the saved locale (or detects one). Call once at app start. */
export async function initLocale(): Promise<Locale> {
    try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const locale = (LOCALES as readonly string[]).includes(saved ?? "")
            ? (saved as Locale)
            : detectDeviceLocale();
        setLocaleInternal(locale);
        return locale;
    } catch {
        setLocaleInternal(detectDeviceLocale());
        return currentLocale;
    }
}

export async function setLocale(locale: Locale) {
    setLocaleInternal(locale);
    try {
        await AsyncStorage.setItem(STORAGE_KEY, locale);
    } catch {
        // Persisting is best-effort; the in-memory choice still applies
    }
}

export function getLocale(): Locale {
    return currentLocale;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Current locale as reactive state. */
export function useLocale(): [Locale, (locale: Locale) => Promise<void>] {
    const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
    const change = useCallback((next: Locale) => setLocale(next), []);
    return [locale, change];
}

/**
 * Translator for one namespace, like next-intl's useTranslations("dashboard").
 * Re-renders when the locale changes.
 */
export function useTranslations(namespace: string) {
    const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
    // A NEW function per locale, not a stable one: the React Compiler (and
    // any useMemo) caches JSX by the identity of `t`, so a stable `t` left
    // already-rendered screens in the old language after a switch. Passing
    // the locale explicitly also makes the result independent of i18n.locale
    // timing.
    return useMemo(
        () =>
            (key: string, options?: Record<string, unknown>) =>
                i18n.t(`${namespace}.${key}`, { locale, ...options }),
        [namespace, locale],
    );
}

/** True once initLocale has resolved — gate the first render on it. */
export function useLocaleReady() {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let cancelled = false;
        initLocale().finally(() => {
            if (!cancelled) setReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return ready;
}

export default i18n;
