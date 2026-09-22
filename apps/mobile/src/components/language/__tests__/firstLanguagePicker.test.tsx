/**
 * The shared list of first languages.
 *
 * What matters here is what a learner who reads no English can see and reach:
 * every language written in its own script, the current one shown as chosen,
 * and a tap that reports a code back rather than a label.
 */

import { render, screen, userEvent } from "@testing-library/react-native";

import { FirstLanguagePicker } from "@/components/language/FirstLanguagePicker";
import { FIRST_LANGUAGES } from "@/lib/firstLanguage/languages";

it("lists every language in its own script, with the English name alongside", () => {
    render(<FirstLanguagePicker value={null} onChange={jest.fn()} label="Your language" />);

    expect(screen.getByLabelText("Your language")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(FIRST_LANGUAGES.length);
    expect(screen.getByLabelText("বাংলা, Bengali")).toBeTruthy();
    // Filipino is called Filipino in both languages: shown in both columns, said once.
    expect(screen.getByLabelText("Filipino")).toBeTruthy();
});

it("marks the current language as chosen and reports the code of the one tapped", async () => {
    const onChange = jest.fn();
    render(<FirstLanguagePicker value="bn" onChange={onChange} label="Your language" />);

    expect(screen.getByLabelText("বাংলা, Bengali").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText("தமிழ், Tamil").props.accessibilityState.checked).toBe(false);

    await userEvent.setup().press(screen.getByLabelText("தமிழ், Tamil"));
    expect(onChange).toHaveBeenCalledWith("ta");
});
