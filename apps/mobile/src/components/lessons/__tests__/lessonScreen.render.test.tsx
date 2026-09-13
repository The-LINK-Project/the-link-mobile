/**
 * Screen-level tests for a lesson run.
 *
 * The join between the screen, the session and the exercise components has been
 * the blind spot twice now. The Check button once handed its press event to the
 * grader instead of the answer, and the screen-reader flag was threaded into the
 * screen and then never passed on, leaving the feature inert while every unit
 * test passed. Both were invisible to tests of either side on its own.
 */

import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import LessonScreen from "@/app/(app)/lesson/[id]";
import { setLocale } from "@/lib/i18n";
import { mrtBasics } from "@/lib/lessons/data/mrt-basics";
import { picturableVocab } from "@/lib/lessons/lookup";
import { seededShuffle } from "@/lib/lessons/shuffle";
import type { SelectPictureExercise } from "@/lib/lessons/types";

jest.mock("expo-router", () => ({
    useLocalSearchParams: () => ({ id: "mrt-basics" }),
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
    Stack: { Screen: () => null },
}));

jest.mock("expo-speech", () => ({
    speak: jest.fn(),
    stop: jest.fn(),
    getAvailableVoicesAsync: jest.fn().mockResolvedValue([]),
    VoiceQuality: { Default: "Default", Enhanced: "Enhanced" },
}));

jest.mock("expo-haptics", () => ({
    notificationAsync: jest.fn().mockResolvedValue(undefined),
    NotificationFeedbackType: { Success: "Success", Warning: "Warning" },
}));

/** Pretend a screen reader is, or is not, running before the run is built. */
function withScreenReader(enabled: boolean) {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(enabled);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({
        remove: jest.fn(),
    } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
}

beforeEach(async () => {
    await act(() => setLocale("en"));
});

afterEach(() => {
    jest.restoreAllMocks();
});

/**
 * Which tile holds the answer.
 *
 * Tile order is seeded by exercise id so it is stable, which lets a test press
 * the right one instead of guessing. Computed from the same data the screen
 * uses rather than hard-coded, so reordering the lesson cannot quietly turn this
 * into a test that always presses a wrong tile.
 */
function answerTileLabel(): string {
    const exercise = mrtBasics.exercises.find(
        (item): item is SelectPictureExercise => item.type === "selectPicture",
    )!;
    const order = seededShuffle(picturableVocab(mrtBasics, exercise.choiceVocabIds), exercise.id);
    const index = order.findIndex((item) => item.id === exercise.vocabId);
    return `Picture ${index + 1} of ${order.length}`;
}

describe("a lesson run", () => {
    it("opens on the picture exercise", async () => {
        withScreenReader(false);
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByText("Which one is this?")).toBeTruthy());
        expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy();
        // The word being taught is the prompt, and it is spoken rather than only shown.
        expect(screen.getByText("platform")).toBeTruthy();
        expect(screen.getByLabelText("Listen")).toBeTruthy();
    });

    it("leaves out the picture exercise when a screen reader is running", async () => {
        // Regression: the flag reached the screen but was never passed to the
        // session, so this exercise was still served to screen-reader users.
        withScreenReader(true);
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
        expect(screen.queryByText("Which one is this?")).toBeNull();
        expect(screen.queryByLabelText("Picture 1 of 3")).toBeNull();
    });

    it("grades the learner's choice rather than the press event", async () => {
        // Regression: Check was wired straight to the submit handler, so React
        // passed the press event where the answer belonged and every exercise
        // graded as wrong no matter what was chosen.
        withScreenReader(false);
        const user = userEvent.setup();
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));

        expect(screen.getByText("Correct")).toBeTruthy();
        expect(screen.queryByText("Not quite")).toBeNull();
    });

    it("marks a wrong choice as wrong and reveals the answer", async () => {
        withScreenReader(false);
        const user = userEvent.setup();
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        const wrongTile = ["Picture 1 of 3", "Picture 2 of 3", "Picture 3 of 3"].find(
            (label) => label !== answerTileLabel(),
        )!;
        await user.press(screen.getByLabelText(wrongTile));
        await user.press(screen.getByText("Check"));

        expect(screen.getByText("Not quite")).toBeTruthy();
        // The word is the prompt and stays on screen, so no written solution.
        expect(screen.queryByText("Another way to say it:")).toBeNull();
    });

    it("does not offer Check before anything is chosen", async () => {
        withScreenReader(false);
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByLabelText("Check")).toBeTruthy());
        expect(screen.getByLabelText("Check").props.accessibilityState?.disabled).toBe(true);
    });
});
