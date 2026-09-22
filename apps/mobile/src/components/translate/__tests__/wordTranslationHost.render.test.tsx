/**
 * Holding a word: the bubble opens beside it, answers, and gets out of the way.
 *
 * There is no native gesture system under test, so a hold is made the way the
 * app makes one, in its two halves: the finger comes down on a word, and then
 * `holdAt`, the plain function the root gesture calls, says it stayed there.
 */

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { WordTranslationHost } from "@/components/translate/WordTranslationHost";
import { Button, Text } from "@/components/ui";
import { setFirstLanguage } from "@/lib/firstLanguage/store";
import { setLocale } from "@/lib/i18n";
import { lookupTranslation, type WordTranslation } from "@/lib/translate/lookup";
import { getPopup, holdAt, resetPopupForTests } from "@/lib/translate/popupStore";

const mockEnabled = jest.fn();
jest.mock("react-native-gesture-handler", () => {
    const gesture: Record<string, unknown> = {};
    for (const name of ["minDuration", "maxDistance", "runOnJS", "onStart"]) {
        gesture[name] = () => gesture;
    }
    gesture.enabled = (value: boolean) => {
        mockEnabled(value);
        return gesture;
    };
    return {
        Gesture: { LongPress: () => gesture },
        GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    };
});

let mockPathname = "/";
jest.mock("expo-router", () => ({ usePathname: () => mockPathname }));
jest.mock("expo-haptics", () => ({
    performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
    impactAsync: jest.fn().mockResolvedValue(undefined),
    AndroidHaptics: { Long_Press: "long-press" },
    ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("@expo/vector-icons/Ionicons", () => () => null);

const mockSpeak = jest.fn();
jest.mock("@/lib/lessons/speech", () => ({
    useSpeech: () => ({ speak: mockSpeak, stop: jest.fn(), speaking: false, hasPlayed: false }),
}));
jest.mock("@/lib/translate/lookup", () => ({ lookupTranslation: jest.fn() }));
const lookup = lookupTranslation as jest.Mock;

const SENTENCE = "Find the right platform";
const mockPress = jest.fn();

function App() {
    return (
        <WordTranslationHost>
            <Text>{SENTENCE}</Text>
            <Text>tap out</Text>
            <Button title="Start" onPress={mockPress} />
        </WordTranslationHost>
    );
}

let clock = 0;
const touches = [{}];
const host = () => screen.getByTestId("word-translation-host");

/** A finger comes down on `word`, and the touch bubbles up to the host as it does in the app. */
function touchDownOn(word: RegExp, x = 100, y = 400) {
    const event = { nativeEvent: { pageX: x, pageY: y, timestamp: ++clock, touches } };
    fireEvent(screen.getByText(word), "touchStart", event);
    fireEvent(host(), "touchStart", event);
}

function hold(word: RegExp, x = 100, y = 400) {
    touchDownOn(word, x, y);
    act(() => {
        holdAt(x, y);
    });
    // The gesture system cancels the touch underneath when the hold activates.
    fireEvent(host(), "touchCancel", { nativeEvent: { timestamp: clock, touches: [] } });
}

/** A touch that comes down on nothing in particular, and lifts. */
function tapOutside() {
    const event = { nativeEvent: { pageX: 5, pageY: 5, timestamp: ++clock, touches } };
    fireEvent(host(), "touchStart", event);
    fireEvent(host(), "touchEnd", { nativeEvent: { timestamp: clock, touches: [] } });
}

function answer(over: Partial<WordTranslation> = {}): WordTranslation {
    return {
        word: "platform",
        translation: "প্ল্যাটফর্ম",
        phrase: null,
        source: "network",
        ...over,
    };
}

/** A lookup that answers only when the test says so. */
function pendingLookup() {
    // Filled in when the bubble asks, which is after this returns, so the
    // answer is given through a function that looks it up at that moment.
    let resolve: ((value: WordTranslation) => void) | null = null;
    lookup.mockImplementationOnce(
        () =>
            new Promise<WordTranslation>((yes) => {
                resolve = yes;
            }),
    );
    return {
        answerWith: (value: WordTranslation) =>
            act(async () => {
                if (!resolve) throw new Error("The bubble never asked for a translation.");
                resolve(value);
            }),
    };
}

beforeEach(async () => {
    jest.clearAllMocks();
    mockPathname = "/";
    resetPopupForTests();
    await act(() => setLocale("en"));
    await act(() => setFirstLanguage("bn"));
});

it("opens for the held word, shows it is working, then shows the translation", async () => {
    const pending = pendingLookup();
    render(<App />);
    hold(/^platform$/);

    expect(screen.getByLabelText("Translating…")).toBeTruthy();
    expect(lookup).toHaveBeenCalledWith(
        expect.objectContaining({ word: "platform", context: SENTENCE, language: "bn" }),
    );

    await pending.answerWith(answer());
    expect(screen.getByText("প্ল্যাটফর্ম")).toBeTruthy();
    expect(screen.queryByLabelText("Translating…")).toBeNull();
});

it("is two lines and no more: no label for the language, and no close button", async () => {
    lookup.mockResolvedValueOnce(answer());
    render(<App />);
    hold(/^platform$/);
    await screen.findByText("প্ল্যাটফর্ম");

    expect(screen.queryByText(/In /)).toBeNull();
    expect(screen.queryByText(/বাংলা/)).toBeNull();
    expect(screen.queryByLabelText("Close")).toBeNull();
    // What is left: the word, a way to hear it, and the answer.
    expect(screen.getAllByText("platform").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Listen")).toBeTruthy();
});

it("adds one line for the phrase the word belongs to", async () => {
    lookup.mockResolvedValueOnce(
        answer({
            word: "out",
            translation: "বাইরে",
            phrase: { text: "tap out", translation: "কার্ড ছোঁয়ানো" },
        }),
    );
    render(<App />);
    hold(/^out$/);

    expect(await screen.findByText("বাইরে")).toBeTruthy();
    expect(screen.getByText(/tap out\s+·\s+কার্ড ছোঁয়ানো/)).toBeTruthy();
});

it("says the word aloud from the speaker button", async () => {
    lookup.mockResolvedValueOnce(answer());
    render(<App />);
    hold(/^platform$/);
    await screen.findByText("প্ল্যাটফর্ম");

    fireEvent.press(screen.getByLabelText("Listen"));
    expect(mockSpeak).toHaveBeenCalledWith("platform");
});

it("says so when the word could not be translated, and tries again when asked", async () => {
    lookup.mockRejectedValueOnce(Object.assign(new Error("no"), { reason: "failed" }));
    render(<App />);
    hold(/^platform$/);

    expect(await screen.findByText("We could not translate this word.")).toBeTruthy();

    lookup.mockResolvedValueOnce(answer());
    fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByText("প্ল্যাটফর্ম")).toBeTruthy();
    expect(lookup).toHaveBeenCalledTimes(2);
});

it("tells a learner with no connection that this is what is wrong", async () => {
    lookup.mockRejectedValueOnce(Object.assign(new Error("no"), { reason: "offline" }));
    render(<App />);
    hold(/^platform$/);

    expect(await screen.findByText("No internet. Try again when you are online.")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
});

it("closes on a touch anywhere else, and stops the lookup it no longer needs", async () => {
    const pending = pendingLookup();
    render(<App />);
    hold(/^platform$/);
    const { signal } = lookup.mock.calls[0][0] as { signal: AbortSignal };
    expect(signal.aborted).toBe(false);

    tapOutside();
    expect(screen.queryByTestId("word-bubble")).toBeNull();
    expect(signal.aborted).toBe(true);

    // The answer arriving afterwards is for nobody, and must not bring it back.
    await pending.answerWith(answer());
    expect(screen.queryByText("প্ল্যাটফর্ম")).toBeNull();
});

it("stays open for a touch on the bubble itself", async () => {
    lookup.mockResolvedValueOnce(answer());
    render(<App />);
    hold(/^platform$/);
    await screen.findByText("প্ল্যাটফর্ম");

    const event = { nativeEvent: { pageX: 100, pageY: 350, timestamp: ++clock, touches } };
    fireEvent(screen.getByTestId("word-bubble"), "touchStart", event);
    fireEvent(host(), "touchStart", event);
    fireEvent(host(), "touchEnd", { nativeEvent: { timestamp: clock, touches: [] } });

    expect(screen.getByTestId("word-bubble")).toBeTruthy();
});

it("moves to a second word held while it is open, rather than closing first", async () => {
    lookup.mockResolvedValueOnce(answer());
    render(<App />);
    hold(/^platform$/);
    await screen.findByText("প্ল্যাটফর্ম");
    const first = getPopup()?.id;

    lookup.mockResolvedValueOnce(answer({ word: "right", translation: "সঠিক" }));
    // The finger is down on the new word and has not lifted: still the old bubble.
    touchDownOn(/^right\s*$/, 60, 400);
    expect(screen.getByText("প্ল্যাটফর্ম")).toBeTruthy();

    act(() => {
        holdAt(60, 400);
    });
    fireEvent(host(), "touchCancel", { nativeEvent: { timestamp: clock, touches: [] } });

    expect(await screen.findByText("সঠিক")).toBeTruthy();
    expect(screen.queryByText("প্ল্যাটফর্ম")).toBeNull();
    expect(screen.getAllByTestId("word-bubble")).toHaveLength(1);
    expect(getPopup()?.id).not.toBe(first);
});

it("closes on the back button without leaving the screen, and only listens while open", async () => {
    const listen = jest.spyOn(BackHandler, "addEventListener");
    lookup.mockResolvedValueOnce(answer());
    render(<App />);
    expect(listen).not.toHaveBeenCalled();

    hold(/^platform$/);
    await screen.findByText("প্ল্যাটফর্ম");
    const onBack = listen.mock.calls[0][1] as () => boolean | null | undefined;

    let handled: boolean | null | undefined;
    act(() => {
        handled = onBack();
    });
    // True tells the system the press was dealt with, so the screen stays.
    expect(handled).toBe(true);
    expect(screen.queryByTestId("word-bubble")).toBeNull();
    listen.mockRestore();
});

it("closes when the learner moves to another screen", async () => {
    lookup.mockResolvedValueOnce(answer());
    const view = render(<App />);
    hold(/^platform$/);
    await screen.findByText("প্ল্যাটফর্ম");

    mockPathname = "/lesson/mrt-basics";
    view.rerender(<App />);
    expect(screen.queryByTestId("word-bubble")).toBeNull();
});

it("only lets the hold gesture run for a touch that came down on a word", () => {
    // Left on, the gesture would cancel any slow press anywhere: a learner who
    // rests a finger on a picture tile for half a second would find it did
    // nothing, and Android's own long press in a text field would be cut off.
    render(<App />);
    const enabled = () => mockEnabled.mock.calls[mockEnabled.mock.calls.length - 1][0];
    expect(enabled()).toBe(true);

    const event = { nativeEvent: { pageX: 5, pageY: 5, timestamp: ++clock, touches } };
    fireEvent(host(), "touchStart", event);
    expect(enabled()).toBe(false);

    // Ready again as soon as that finger lifts.
    fireEvent(host(), "touchEnd", { nativeEvent: { timestamp: clock, touches: [] } });
    expect(enabled()).toBe(true);

    touchDownOn(/^platform$/);
    expect(enabled()).toBe(true);
});

it("does not treat a second finger as a hold", () => {
    render(<App />);
    const event = {
        nativeEvent: { pageX: 100, pageY: 400, timestamp: ++clock, touches: [{}, {}] },
    };
    fireEvent(screen.getByText(/^platform$/), "touchStart", event);
    fireEvent(host(), "touchStart", event);

    expect(mockEnabled.mock.calls[mockEnabled.mock.calls.length - 1][0]).toBe(false);
    expect(holdAt(100, 400)).toBe(false);
});

it("still presses a button whose word was only tapped", () => {
    render(<App />);
    fireEvent.press(screen.getByLabelText("Start"));
    expect(mockPress).toHaveBeenCalledTimes(1);
});

it("places itself on the word once it knows how wide it is", async () => {
    lookup.mockResolvedValueOnce(answer());
    render(<App />);
    hold(/^platform$/, 200, 400);
    await screen.findByText("প্ল্যাটফর্ম");

    const bubble = screen.getByTestId("word-bubble");
    fireEvent(bubble, "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 120, height: 70 } },
    });
    // Centred on the finger: 200 less half of 120.
    expect(screen.getByTestId("word-bubble")).toHaveStyle({ left: 140 });
});

it("does nothing for a learner with no first language", async () => {
    const { resetFirstLanguageForTests } = jest.requireActual("@/lib/firstLanguage/store");
    act(() => resetFirstLanguageForTests());
    render(<App />);

    expect(mockEnabled.mock.calls[mockEnabled.mock.calls.length - 1][0]).toBe(false);
    // The text is drawn whole, so there is no word for a finger to come down on.
    expect(screen.getByText(SENTENCE).props.children).toBe(SENTENCE);
});
