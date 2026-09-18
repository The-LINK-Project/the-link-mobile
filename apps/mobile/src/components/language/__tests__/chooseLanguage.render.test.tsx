/**
 * The question asked once, right after a learner first signs in.
 *
 * The screen is the only way into the app for a learner who has not answered
 * it, so the three things under test are the three that could trap them: the
 * guess it starts on, the button staying shut until there is an answer, and the
 * answer being saved on the phone, which is all that works on a worksite.
 */

import { act, render, screen, userEvent } from "@testing-library/react-native";

import ChooseLanguageScreen from "@/app/(app)/choose-language";
import { getFirstLanguage, resetFirstLanguageForTests } from "@/lib/firstLanguage/store";
import i18n, { setLocale } from "@/lib/i18n";

jest.mock("expo-image", () => ({ Image: () => null }));

/** The onboarding copy in whatever language the screen is showing. */
const label = (key: string) => i18n.t(`mobile.firstLanguage.${key}`);

beforeEach(async () => {
    resetFirstLanguageForTests();
    await act(() => setLocale("en"));
});

it("asks nothing twice: the app's own language starts the list chosen", async () => {
    // A learner who already put the app into Tamil has told us something.
    await act(() => setLocale("ta"));
    render(<ChooseLanguageScreen />);

    expect(screen.getByLabelText("தமிழ், Tamil").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText(label("continue")).props.accessibilityState.disabled).toBe(false);
});

it("waits for an answer before it lets the learner on", async () => {
    // The app is in English and the phone says English, so there is no guess.
    render(<ChooseLanguageScreen />);

    expect(screen.getByText(label("title"))).toBeTruthy();
    expect(screen.getByText(label("changeLater"))).toBeTruthy();
    const continueButton = screen.getByLabelText(label("continue"));
    expect(continueButton.props.accessibilityState.disabled).toBe(true);

    const user = userEvent.setup();
    await user.press(continueButton);
    expect(getFirstLanguage()).toBeNull();

    await user.press(screen.getByLabelText("বাংলা, Bengali"));
    expect(screen.getByLabelText(label("continue")).props.accessibilityState.disabled).toBe(false);
});

it("saves the answer on the phone, where the bubble can read it", async () => {
    const user = userEvent.setup();
    render(<ChooseLanguageScreen />);

    await user.press(screen.getByLabelText("മലയാളം, Malayalam"));
    await user.press(screen.getByLabelText(label("continue")));

    expect(getFirstLanguage()).toBe("ml");
});
