import { getDailyMix, listLessons } from "@/lib/lessons/data";
import { hasTranslation, localized } from "@/lib/lessons/localized";
import type { Localized } from "@/lib/lessons/types";

import { FIRST_LANGUAGES } from "../languages";

jest.mock("expo-localization", () => ({ getLocales: () => [] }));

/** Every `{ en, ... }` object anywhere in a lesson, however deeply nested. */
function localizedStrings(value: unknown, found: Localized[] = []): Localized[] {
    if (Array.isArray(value)) {
        for (const item of value) localizedStrings(item, found);
    } else if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.en === "string") {
            found.push(record as Localized);
        } else {
            for (const item of Object.values(record)) localizedStrings(item, found);
        }
    }
    return found;
}

it("explains every lesson in every first language", () => {
    const lessons = [...listLessons(), getDailyMix()];
    for (const lesson of lessons) {
        for (const value of localizedStrings(lesson)) {
            for (const language of FIRST_LANGUAGES) {
                const text = localized(value, language);
                if (language === "en") {
                    expect(text).toBe(value.en);
                    expect(hasTranslation(value, language)).toBe(false);
                } else {
                    expect({ language, en: value.en, text }).not.toEqual({
                        language,
                        en: value.en,
                        text: value.en,
                    });
                    expect(hasTranslation(value, language)).toBe(true);
                }
            }
        }
    }
});
