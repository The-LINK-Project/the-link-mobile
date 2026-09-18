import {
    FIRST_LANGUAGES,
    FIRST_LANGUAGE_ENGLISH_NAMES,
    FIRST_LANGUAGE_LABELS,
    isFirstLanguage,
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

it("accepts only the twelve codes", () => {
    expect(isFirstLanguage("bn")).toBe(true);
    expect(isFirstLanguage("zh")).toBe(true);
    // English is not a first language here: there would be nothing to translate to.
    expect(isFirstLanguage("en")).toBe(false);
    expect(isFirstLanguage("xx")).toBe(false);
    expect(isFirstLanguage(undefined)).toBe(false);
    expect(isFirstLanguage({ language: "bn" })).toBe(false);
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
});

it("does not offer a Finn Filipino", () => {
    // "fi" is Filipino in our catalogues and Finnish on a phone. Guessing here
    // would be worse than not guessing.
    device("fi-FI");
    expect(suggestFirstLanguage()).toBeNull();
});

it("takes the first phone language it recognises", () => {
    device("fr-FR", "ta-SG", "hi-IN");
    expect(suggestFirstLanguage()).toBe("ta");
});

it("suggests nothing when it knows nothing", () => {
    device("fr-FR");
    expect(suggestFirstLanguage()).toBeNull();
    device();
    expect(suggestFirstLanguage()).toBeNull();
});
