/**
 * The language under Account.
 *
 * There is one. A second row for the app's own language used to sit above it,
 * and had stopped changing anything a learner could see. This checks that the
 * row says it opens, that a change is saved the moment it is tapped, and that
 * the screens the learner's language does not reach directly follow it too.
 */

import { act, render, screen, userEvent } from "@testing-library/react-native";

import AccountScreen from "@/app/(app)/(tabs)/account";
import { useLocaleFollowsFirstLanguage } from "@/lib/firstLanguage/interfaceCopy";
import {
    getFirstLanguage,
    resetFirstLanguageForTests,
    setFirstLanguage,
} from "@/lib/firstLanguage/store";
import i18n, { setLocale } from "@/lib/i18n";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@clerk/expo", () => ({
    useUser: () => ({
        user: {
            username: "ruhan",
            fullName: "Ruhan Ahmed",
            primaryEmailAddress: { emailAddress: "ruhan@example.com" },
            passwordEnabled: true,
            imageUrl: null,
        },
    }),
    useClerk: () => ({ signOut: jest.fn() }),
}));

/** An account string in whatever language the screen is showing. */
const label = (key: string, locale = "en") => i18n.t(`mobile.account.${key}`, { locale });

beforeEach(async () => {
    resetFirstLanguageForTests();
    await act(() => setLocale("en"));
});

it("shows the language the learner chose, and changes it in one tap", async () => {
    await act(() => setFirstLanguage("bn"));
    render(<AccountScreen />);

    const myLanguage = () => screen.getByLabelText(`${label("myLanguage", "bn")}, বাংলা`);
    expect(screen.getByText(label("myLanguageHint", "bn"))).toBeTruthy();

    const user = userEvent.setup();
    await user.press(myLanguage());
    expect(myLanguage().props.accessibilityState.expanded).toBe(true);

    await user.press(screen.getByLabelText("தமிழ், Tamil"));
    expect(getFirstLanguage()).toBe("ta");
    // Answered, so the list folds away again and the row carries the answer.
    expect(screen.queryByLabelText("தமிழ், Tamil")).toBeNull();
    expect(screen.getByLabelText(`${label("myLanguage", "ta")}, தமிழ்`)).toBeTruthy();
});

it("uses the learner's language for Account, while lesson content remains separate", async () => {
    await act(() => setFirstLanguage("bn"));
    const user = userEvent.setup();
    render(<AccountScreen />);

    await user.press(screen.getByLabelText(`${label("myLanguage", "bn")}, বাংলা`));
    expect(screen.getByLabelText("తెలుగు, Telugu")).toBeTruthy();
    // One setting, not two that could disagree.
    expect(screen.queryByText("অ্যাপের ভাষা")).toBeNull();
});

it("offers English, and stops promising a translation nobody will get", async () => {
    await act(() => setFirstLanguage("bn"));
    const user = userEvent.setup();
    render(<AccountScreen />);

    await user.press(screen.getByLabelText(`${label("myLanguage", "bn")}, বাংলা`));
    await user.press(screen.getByLabelText("English"));

    expect(getFirstLanguage()).toBe("en");
    expect(screen.getByLabelText(`${label("myLanguage")}, English`)).toBeTruthy();
    // Holding an English word does nothing for a learner who reads English.
    expect(screen.queryByText(label("myLanguageHint"))).toBeNull();
});

describe("the rest of the app", () => {
    function Follower() {
        useLocaleFollowsFirstLanguage();
        return null;
    }

    it("follows the learner's language where the app is written in it", async () => {
        render(<Follower />);
        await act(() => setFirstLanguage("ta"));
        expect(i18n.locale).toBe("ta");
        // No Chinese catalogue: Privacy and About fall back to English rather
        // than staying in the Tamil the last choice left behind.
        await act(() => setFirstLanguage("zh"));
        expect(i18n.locale).toBe("en");
    });
});

it("uses the onboarding language for Account even when it has no full app catalogue", async () => {
    await act(() => setFirstLanguage("zh"));
    render(<AccountScreen />);

    expect(screen.getByText("账户")).toBeTruthy();
    expect(screen.getByText("长按任何英文单词，即可用此语言查看它。")).toBeTruthy();
});
