import i18n, { setLocale, initLocale, getLocale, LOCALES } from "../i18n";

import en from "@/messages/en.json";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
}));

function keysOf(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
        keysOf(child, prefix ? `${prefix}.${key}` : key),
    );
}

test("language choice updates the active catalog and falls back for new foundation copy", async () => {
    await initLocale();
    expect(getLocale()).toBe("en");
    await setLocale("bn");
    expect(getLocale()).toBe("bn");
    expect(i18n.t("mobile.account.signOut")).not.toContain("missing");
    expect(i18n.t("mobile.foundation.home")).toBe("হোম");
});

test("Hindi is an app language, since the tutor already teaches from it", async () => {
    expect(LOCALES).toContain("hi");
    await setLocale("hi");
    expect(i18n.t("mobile.lessons.check")).toBe("जाँचें");
});

test.each(LOCALES.filter((locale) => locale !== "en"))(
    "%s translates every string a learner meets in a lesson or speaking practice",
    (locale) => {
        // A lesson screen that drops back to English for one button is exactly
        // the reading task the pictures and tiles are there to avoid.
        const catalogue = i18n.translations[locale];
        const untranslated = keysOf(en)
            .filter((key) => key.startsWith("mobile."))
            .filter((key) => i18n.t(key, { locale, defaultValue: "" }) === "");
        expect(catalogue).toBeDefined();
        expect(untranslated).toEqual([]);
    },
);
