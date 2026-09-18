/**
 * The two languages under Account.
 *
 * The app's language and the learner's own language sit next to each other and
 * mean different things, so this checks that each row says which is which, that
 * a change is saved the moment it is tapped, and that only one list is ever open
 * at a time.
 */

import { act, render, screen, userEvent } from "@testing-library/react-native";

import AccountScreen from "@/app/(app)/(tabs)/account";
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
const label = (key: string) => i18n.t(`mobile.account.${key}`);

beforeEach(async () => {
    resetFirstLanguageForTests();
    await act(() => setLocale("en"));
});

it("shows the language the learner chose, and changes it in one tap", async () => {
    await act(() => setFirstLanguage("bn"));
    render(<AccountScreen />);

    const myLanguage = () => screen.getByLabelText(`${label("myLanguage")}, বাংলা`);
    expect(screen.getByText(label("myLanguageHint"))).toBeTruthy();

    const user = userEvent.setup();
    await user.press(myLanguage());
    expect(myLanguage().props.accessibilityState.expanded).toBe(true);

    await user.press(screen.getByLabelText("தமிழ், Tamil"));
    expect(getFirstLanguage()).toBe("ta");
    // Answered, so the list folds away again and the row carries the answer.
    expect(screen.queryByLabelText("தமிழ், Tamil")).toBeNull();
    expect(screen.getByLabelText(`${label("myLanguage")}, தமிழ்`)).toBeTruthy();
});

it("keeps the app's language and the learner's language apart", async () => {
    await act(() => setFirstLanguage("bn"));
    const user = userEvent.setup();
    render(<AccountScreen />);

    await user.press(screen.getByLabelText(`${label("myLanguage")}, বাংলা`));
    expect(screen.getByLabelText("తెలుగు, Telugu")).toBeTruthy();

    // Opening the app-language list closes the other one, rather than pushing
    // nineteen rows down the screen.
    await user.press(screen.getByLabelText(`${label("appLanguage")}, English`));
    expect(screen.queryByLabelText("తెలుగు, Telugu")).toBeNull();
    expect(screen.getByLabelText("Filipino")).toBeTruthy();

    // The app's language is a separate choice; the learner's own is untouched.
    await user.press(screen.getByLabelText("Filipino"));
    expect(i18n.locale).toBe("fi");
    expect(getFirstLanguage()).toBe("bn");
});
