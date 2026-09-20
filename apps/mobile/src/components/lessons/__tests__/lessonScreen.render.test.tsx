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
import * as Speech from "expo-speech";
import { AccessibilityInfo } from "react-native";

import LessonScreen from "@/app/(app)/lesson/[id]";
import { resetFirstLanguageForTests, setFirstLanguage } from "@/lib/firstLanguage/store";
import { setLocale } from "@/lib/i18n";
import { mrtBasics } from "@/lib/lessons/data/mrt-basics";
import { picturableVocab } from "@/lib/lessons/lookup";
import { buildQueue, fingerprint } from "@/lib/lessons/session";
import { seededShuffle } from "@/lib/lessons/shuffle";
import type { SelectPictureExercise } from "@/lib/lessons/types";
import { completeLesson, getProgressData, saveRun } from "@/lib/progress/store";

jest.mock("expo-router", () => ({
    useLocalSearchParams: () => ({ id: "mrt-basics" }),
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
    Stack: { Screen: () => null },
}));

jest.mock("expo-speech", () => ({
    speak: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
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
    resetFirstLanguageForTests();
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

/** Open the lesson and go past the word list, to the first exercise. */
async function startLesson() {
    const user = userEvent.setup();
    const view = render(<LessonScreen />);
    await waitFor(() => expect(screen.getByText("Start")).toBeTruthy());
    await user.press(screen.getByText("Start"));
    return { user, view };
}

describe("opening a lesson", () => {
    it("shows the words and what they mean before asking anything", async () => {
        withScreenReader(false);
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByText("Words in this lesson")).toBeTruthy());
        // Every word of the lesson, each with its meaning, and no question.
        for (const item of mrtBasics.vocab) {
            expect(screen.getByText(item.term)).toBeTruthy();
            expect(screen.getByText(item.meaning.en)).toBeTruthy();
        }
        expect(screen.queryByText("Check")).toBeNull();
    });

    it("uses the first language for directions and meanings but keeps lesson content English", async () => {
        withScreenReader(false);
        await act(() => setFirstLanguage("bn"));
        const user = userEvent.setup();
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByText("এই পাঠের শব্দ")).toBeTruthy());
        expect(
            screen.queryByText("সঠিক প্ল্যাটফর্ম খোঁজা, কার্ডে টাকা ভরা, আর ঠিক স্টেশনে নামা।"),
        ).toBeNull();
        expect(
            screen.getByText(
                "Find the right platform, top up your card, and get off at the right stop.",
            ),
        ).toBeTruthy();
        expect(screen.getByText("platform")).toBeTruthy();
        expect(screen.getByText("যেখানে ট্রেনের জন্য অপেক্ষা করেন")).toBeTruthy();
        expect(screen.getByText("শব্দে চাপ দিলে শুনতে পাবেন। তৈরি হলে শুরু করুন।")).toBeTruthy();

        await user.press(screen.getByText("শুরু করুন"));
        await waitFor(() => expect(screen.getByText("এটি কোনটি?")).toBeTruthy());
        expect(screen.getByText("platform")).toBeTruthy();
    });

    it("says a word aloud when it is tapped", async () => {
        withScreenReader(false);
        const user = userEvent.setup();
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByText("platform")).toBeTruthy());
        await user.press(screen.getByText("platform"));
        await waitFor(() =>
            expect(Speech.speak).toHaveBeenCalledWith("platform", expect.anything()),
        );
    });

    it("comes back to where the learner was, without the word list", async () => {
        withScreenReader(false);
        const { user, view } = await startLesson();
        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));
        expect(getProgressData().runs["mrt-basics"]?.position).toBe(1);

        // The phone closes the app: the screen goes, what was saved stays.
        view.unmount();
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
        expect(screen.queryByText("Words in this lesson")).toBeNull();
        expect(screen.queryByText("Which one is this?")).toBeNull();
    });

    it("starts again from the words when the saved run is for different exercises", async () => {
        withScreenReader(false);
        saveRun("mrt-basics", {
            fingerprint: "an-older-version-of-this-lesson",
            locale: "en",
            screenReader: false,
            queue: ["ex-gone", "ex-also-gone"],
            position: 1,
            records: {},
            requeued: [],
        });
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByText("Words in this lesson")).toBeTruthy());
    });

    it("says a finished lesson is done rather than starting it again", async () => {
        withScreenReader(false);
        completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
        const user = userEvent.setup();
        render(<LessonScreen />);

        // It used to open on the first question, as if nothing had been kept.
        await waitFor(() => expect(screen.getByText("Lesson done!")).toBeTruthy());
        expect(screen.getByText("7 of 9")).toBeTruthy();
        expect(screen.queryByText("Start")).toBeNull();
        expect(screen.queryByText("Check")).toBeNull();
        // The words are still there to look over.
        expect(screen.getByText(mrtBasics.vocab[0].term)).toBeTruthy();

        // Going through it again is a choice, and skips the word list.
        await user.press(screen.getByText("Practise again"));
        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
    });
});

describe("a lesson run", () => {
    it("is finished by its last answer, without waiting for Continue", async () => {
        withScreenReader(false);
        const picture = mrtBasics.exercises.find((item) => item.type === "selectPicture")!.id;
        const others = buildQueue(mrtBasics.exercises, "en").filter((id) => id !== picture);
        saveRun("mrt-basics", {
            fingerprint: fingerprint(mrtBasics),
            locale: "en",
            screenReader: false,
            // Everything else answered; the picture exercise is the last one.
            queue: [...others, picture],
            position: others.length,
            records: Object.fromEntries(
                others.map((id) => [id, { attempts: 1, firstTryCorrect: true }]),
            ),
            requeued: [],
        });
        const user = userEvent.setup();
        const view = render(<LessonScreen />);

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));

        // A learner who closes the app on this feedback has done every
        // exercise. The lesson used to stay unfinished until Continue was
        // pressed, with the kept run still pointing at this last exercise.
        expect(getProgressData().progress.lessons["mrt-basics"]).toMatchObject({
            runs: 1,
            bestFirstTry: others.length + 1,
            total: others.length + 1,
        });
        expect(getProgressData().runs["mrt-basics"]).toBeUndefined();

        // Pressing Continue afterwards must not count the lesson twice.
        await user.press(screen.getByText("Finish"));
        await waitFor(() => expect(screen.getByText("Lesson done!")).toBeTruthy());
        expect(getProgressData().progress.lessons["mrt-basics"].runs).toBe(1);
        view.unmount();
    });

    it("opens on the picture exercise", async () => {
        withScreenReader(false);
        await startLesson();

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
        await startLesson();

        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
        expect(screen.queryByText("Which one is this?")).toBeNull();
        expect(screen.queryByLabelText("Picture 1 of 3")).toBeNull();
    });

    it("grades the learner's choice rather than the press event", async () => {
        // Regression: Check was wired straight to the submit handler, so React
        // passed the press event where the answer belonged and every exercise
        // graded as wrong no matter what was chosen.
        withScreenReader(false);
        const { user } = await startLesson();

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));

        expect(screen.getByText("Correct!")).toBeTruthy();
        expect(screen.queryByText("Not quite")).toBeNull();
    });

    it("marks a wrong choice as wrong and reveals the answer", async () => {
        withScreenReader(false);
        const { user } = await startLesson();

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        const wrongTile = ["Picture 1 of 3", "Picture 2 of 3", "Picture 3 of 3"].find(
            (label) => label !== answerTileLabel(),
        )!;
        await user.press(screen.getByLabelText(wrongTile));
        await user.press(screen.getByText("Check"));

        expect(screen.getByText("Not quite")).toBeTruthy();
        // The word is the prompt and stays on screen, so no written solution.
        expect(screen.queryByText("You can also say:")).toBeNull();
    });

    it("does not offer Check before anything is chosen", async () => {
        withScreenReader(false);
        await startLesson();

        await waitFor(() => expect(screen.getByLabelText("Check")).toBeTruthy());
        expect(screen.getByLabelText("Check").props.accessibilityState?.disabled).toBe(true);
    });
});
