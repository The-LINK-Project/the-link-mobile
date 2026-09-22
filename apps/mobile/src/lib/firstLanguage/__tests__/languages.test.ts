import {
    FIRST_LANGUAGES,
    FIRST_LANGUAGE_ENGLISH_NAMES,
    FIRST_LANGUAGE_LABELS,
    TRANSLATION_LANGUAGES,
    isFirstLanguage,
    isTranslationLanguage,
    suggestFirstLanguage,
} from "../languages";

const mockDevice: { locales: { languageCode: string | null; languageTag: string }[] } = {
    locales: [],
};
const mockApp: { locale: string } = { locale: "en" };

jest.mock("expo-localization", () => ({ getLocales: () => mockDevice.locales }));
jest.mock("@/lib/i18n", () => ({ getLocale: () => mockApp.locale }));

/** One device language, as expo-localization reports it. */
function device(...tags: string[]) {
    mockDevice.locales = tags.map((tag) => ({ languageCode: tag.split("-")[0], languageTag: tag }));
}

beforeEach(() => {
    mockApp.locale = "en";
    device();
});

it("names every language it offers, in its own script and in English", () => {
    for (const language of FIRST_LANGUAGES) {
        expect(FIRST_LANGUAGE_LABELS[language]).toBeTruthy();
        expect(FIRST_LANGUAGE_ENGLISH_NAMES[language]).toBeTruthy();
    }
});

it("accepts only the codes it offers", () => {
    expect(isFirstLanguage("bn")).toBe(true);
    expect(isFirstLanguage("zh")).toBe(true);
    expect(isFirstLanguage("xx")).toBe(false);
    expect(isFirstLanguage(undefined)).toBe(false);
    expect(isFirstLanguage({ language: "bn" })).toBe(false);
});

it("offers English as a first language, but never as one to translate into", () => {
    expect(isFirstLanguage("en")).toBe(true);
    expect(FIRST_LANGUAGES[FIRST_LANGUAGES.length - 1]).toBe("en");
    // There is nothing to put an English word into, and the tutor explains
    // English from another language.
    expect(isTranslationLanguage("en")).toBe(false);
    expect(TRANSLATION_LANGUAGES).toHaveLength(FIRST_LANGUAGES.length - 1);
    expect(TRANSLATION_LANGUAGES).not.toContain("en");
});

it("never guesses English from the phone, which is in English whoever owns it", () => {
    mockApp.locale = "en";
    device("en-SG");
    expect(suggestFirstLanguage()).toBeNull();
});

it("suggests the language the learner already chose for the app", () => {
    mockApp.locale = "ta";
    device("hi-IN");
    expect(suggestFirstLanguage()).toBe("ta");
});

it("falls back to the phone's language when the app is in English", () => {
    mockApp.locale = "en";
    device("bn-BD");
    expect(suggestFirstLanguage()).toBe("bn");
});

it("maps the codes phones use to the codes this app uses", () => {
    device("my-MM");
    expect(suggestFirstLanguage()).toBe("bu");
    device("fil-PH");
    expect(suggestFirstLanguage()).toBe("fi");
    device("tl");
    expect(suggestFirstLanguage()).toBe("fi");
    device("id-ID");
    expect(suggestFirstLanguage()).toBe("in");
    device("in");
    expect(suggestFirstLanguage()).toBe("in");
    // Any Chinese is offered Simplified; we do not ask a learner about scripts.
    device("zh-Hans-CN");
    expect(suggestFirstLanguage()).toBe("zh");
    device("fr-CA");
    expect(suggestFirstLanguage()).toBe("fr");
    device("es-MX");
    expect(suggestFirstLanguage()).toBe("es");
});

it("does not offer a Finn Filipino", () => {
    // "fi" is Filipino in our catalogues and Finnish on a phone. Guessing here
    // would be worse than not guessing.
    device("fi-FI");
    expect(suggestFirstLanguage()).toBeNull();
});

it("takes the first phone language it recognises", () => {
    device("de-DE", "ta-SG", "hi-IN");
    expect(suggestFirstLanguage()).toBe("ta");
});

it("suggests nothing when it knows nothing", () => {
    device("de-DE");
    expect(suggestFirstLanguage()).toBeNull();
    device();
    expect(suggestFirstLanguage()).toBeNull();
});
