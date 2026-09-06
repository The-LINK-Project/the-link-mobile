import i18n, { setLocale, initLocale, getLocale } from "../i18n";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
}));

test("language choice updates the active catalog and falls back for new foundation copy", async () => {
    await initLocale();
    expect(getLocale()).toBe("en");
    await setLocale("bn");
    expect(getLocale()).toBe("bn");
    expect(i18n.t("mobile.account.signOut")).not.toContain("missing");
    expect(i18n.t("mobile.foundation.home")).toBe("Home");
});
