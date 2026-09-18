/**
 * The one place the app draws text, and so the one place a word becomes holdable.
 */

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { setScreenReaderForTests } from "@/components/translate/useHoldToTranslate";
import { Text } from "@/components/ui";
import { setFirstLanguage } from "@/lib/firstLanguage/store";
import { getPopup, holdAt, isWordTouch, resetPopupForTests } from "@/lib/translate/popupStore";

const SENTENCE = "Find the right platform, top up your card.";

let clock = 0;
function touchDown(element: ReactTestInstance, x = 50, y = 60) {
    const timestamp = ++clock;
    fireEvent(element, "touchStart", {
        nativeEvent: { pageX: x, pageY: y, timestamp, touches: [{}] },
    });
    return timestamp;
}

/** What the pieces of a text draw, in order. */
function pieces(element: ReactTestInstance): string[] {
    return element.children.map((child) =>
        typeof child === "string" ? `bare:${child}` : String(child.props.children),
    );
}

beforeEach(() => {
    resetPopupForTests();
    act(() => setScreenReaderForTests(false));
});

it("draws exactly what it always drew until the learner has a first language", () => {
    render(<Text>{SENTENCE}</Text>);
    expect(screen.getByText(SENTENCE).props.children).toBe(SENTENCE);
    // One element and no more: a screen's getByText("Done") must not start
    // matching a word inside it as well.
    expect(screen.getAllByText(/platform/)).toHaveLength(1);
});

it("leaves text alone when told it is not to be translated", async () => {
    await act(() => setFirstLanguage("bn"));
    render(<Text translatable={false}>adrish-dev</Text>);

    const name = screen.getByText("adrish-dev");
    expect(name.props.children).toBe("adrish-dev");
    // Nothing is noted for a touch on it, so no hold can ever send it anywhere.
    const timestamp = touchDown(name);
    expect(isWordTouch(timestamp)).toBe(false);
    expect(holdAt(50, 60)).toBe(false);
});

it("leaves text alone while a screen reader is running", async () => {
    await act(() => setFirstLanguage("bn"));
    act(() => setScreenReaderForTests(true));
    render(<Text>{SENTENCE}</Text>);
    expect(screen.getByText(SENTENCE).props.children).toBe(SENTENCE);
});

it("makes each word holdable once a first language is set, and still reads the same", async () => {
    await act(() => setFirstLanguage("bn"));
    render(<Text>{SENTENCE}</Text>);

    // The whole sentence is still there to be found, and so is a single word.
    expect(screen.getByText(SENTENCE)).toBeTruthy();
    const timestamp = touchDown(screen.getByText(/^platform\W*$/), 120, 300);
    expect(isWordTouch(timestamp)).toBe(true);

    act(() => {
        expect(holdAt(120, 300)).toBe(true);
    });
    // The word without its comma, and the sentence it was in.
    expect(getPopup()).toMatchObject({ word: "platform", context: SENTENCE, x: 120, y: 300 });
});

it("gives every character to some word, so a finger that lands on a gap still finds one", async () => {
    // A hold that lands beside a word used to count as missing the text, and
    // inside a card the hold then ended as a press on the card.
    await act(() => setFirstLanguage("bn"));
    render(<Text>{`  ${SENTENCE}`}</Text>);

    const drawn = pieces(screen.getByText(`  ${SENTENCE}`));
    expect(drawn.join("")).toBe(`  ${SENTENCE}`);
    expect(drawn.some((piece) => piece.startsWith("bare:"))).toBe(false);
    expect(drawn).toContain("platform, ");

    touchDown(screen.getByText("platform, "), 10, 10);
    act(() => {
        holdAt(10, 10);
    });
    expect(getPopup()?.word).toBe("platform");
});

it("does not split what has no English in it", async () => {
    await act(() => setFirstLanguage("bn"));
    render(<Text>প্ল্যাটফর্ম 2 / 4</Text>);
    expect(screen.getByText("প্ল্যাটফর্ম 2 / 4").props.children).toBe("প্ল্যাটফর্ম 2 / 4");
});

it("keeps numbers and other children it is given, around the words", async () => {
    await act(() => setFirstLanguage("bn"));
    render(
        <Text>
            Lessons done: {2} of {4}
        </Text>,
    );
    expect(screen.getByText("Lessons done: 2 of 4")).toBeTruthy();
    touchDown(screen.getByText(/^done\W*$/));
    act(() => {
        holdAt(50, 60);
    });
    expect(getPopup()).toMatchObject({ word: "done", context: "Lessons done: 2 of 4" });
});

it("sends the whole sentence for a word in a text nested inside another", async () => {
    // How the fill-in-the-blank exercise draws its sentence: one Text per part.
    await act(() => setFirstLanguage("bn"));
    render(
        <Text variant="heading">
            <Text variant="heading">I want to</Text>
            <Text variant="heading"> top up </Text>
            <Text variant="heading"> my card.</Text>
        </Text>,
    );

    touchDown(screen.getByText(/^up\s*$/));
    act(() => {
        holdAt(50, 60);
    });
    expect(getPopup()).toMatchObject({ word: "up", context: "I want to top up  my card." });
});
