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
import { retryOrder, seededShuffle } from "@/lib/lessons/shuffle";
import { recordingFor } from "@/lib/lessons/speech";
import type { FillBlankExercise, SelectPictureExercise } from "@/lib/lessons/types";
import {
    completeLesson,
    completeSpeaking,
    getProgressData,
    saveRun,
    setResume,
} from "@/lib/progress/store";

const mockRouter = {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => ({
    useLocalSearchParams: () => ({ id: "mrt-basics" }),
    useRouter: () => mockRouter,
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
        // In the tutor's voice: every lesson word has a recording.
        await waitFor(() =>
            expect(jest.requireMock("expo-audio").played).toContain(recordingFor("platform")),
        );
        expect(Speech.speak).not.toHaveBeenCalled();
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

    it("says the talk is still to come when only the exercises are finished", async () => {
        withScreenReader(false);
        completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
        const user = userEvent.setup();
        render(<LessonScreen />);

        // Not "Lesson done!": the talk with the tutor is the lesson's second
        // stage, and the way forward from here.
        await waitFor(() => expect(screen.getByText("Exercises done!")).toBeTruthy());
        expect(screen.queryByText("Lesson done!")).toBeNull();
        expect(screen.getByText("In progress")).toBeTruthy();
        expect(screen.getByText("Now say it aloud to finish the lesson.")).toBeTruthy();
        expect(screen.getByText("7 of 9")).toBeTruthy();

        await user.press(screen.getByText("Practise speaking"));
        expect(mockRouter.replace).toHaveBeenCalledWith("/speak/mrt-basics");
    });

    it("says a finished lesson is done rather than starting it again", async () => {
        withScreenReader(false);
        completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
        completeSpeaking("mrt-basics", { said: 3, total: 3 });
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

        // Pressing Continue afterwards must not count the lesson twice. And
        // what is finished is the exercises: the talk is still to come.
        await user.press(screen.getByText("Finish"));
        await waitFor(() => expect(screen.getByText("Exercises done!")).toBeTruthy());
        expect(screen.queryByText("Lesson done!")).toBeNull();
        expect(screen.getByText("Speak later")).toBeTruthy();
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

/** The run saved for the MRT lesson, if any. */
const savedRun = () => getProgressData().runs["mrt-basics"];

/** How far the progress bar shows, out of 100. */
const progressShown = () => screen.getByLabelText("Lesson progress").props.accessibilityValue?.now;

/** A saved run with everything answered but the picture exercise, which is last. */
function saveRunEndingOnPicture() {
    const picture = mrtBasics.exercises.find((item) => item.type === "selectPicture")!.id;
    const others = buildQueue(mrtBasics.exercises, "en").filter((id) => id !== picture);
    saveRun("mrt-basics", {
        fingerprint: fingerprint(mrtBasics),
        locale: "en",
        screenReader: false,
        queue: [...others, picture],
        position: others.length,
        records: Object.fromEntries(
            others.map((id) => [id, { attempts: 1, firstTryCorrect: true }]),
        ),
        requeued: [],
    });
}

describe("going back and on through a lesson", () => {
    beforeEach(() => {
        mockRouter.back.mockClear();
        mockRouter.replace.mockClear();
    });

    it("goes back from the word list to wherever the learner came from", async () => {
        withScreenReader(false);
        const user = userEvent.setup();
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByText("Words in this lesson")).toBeTruthy());
        await user.press(screen.getByLabelText("Back"));
        expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });

    it("goes back from the first exercise to the word list", async () => {
        withScreenReader(false);
        const { user } = await startLesson();

        await waitFor(() => expect(screen.getByText("Which one is this?")).toBeTruthy());
        await user.press(screen.getByLabelText("Back"));
        await waitFor(() => expect(screen.getByText("Words in this lesson")).toBeTruthy());
        expect(mockRouter.back).not.toHaveBeenCalled();

        await user.press(screen.getByText("Start"));
        await waitFor(() => expect(screen.getByText("Which one is this?")).toBeTruthy());
    });

    it("steps back to an answered exercise and on again, without moving the learner's place", async () => {
        withScreenReader(false);
        const { user } = await startLesson();

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));
        await user.press(screen.getByText("Continue"));
        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
        const progress = progressShown();
        expect(screen.queryByLabelText("Next")).toBeNull();

        await user.press(screen.getByLabelText("Back"));
        // The exercise before, ready to look at again, not its old answer.
        await waitFor(() => expect(screen.getByText("Which one is this?")).toBeTruthy());
        expect(screen.queryByText("Correct!")).toBeNull();
        expect(screen.getByLabelText("Check").props.accessibilityState?.disabled).toBe(true);
        expect(progressShown()).toBe(progress);
        expect(savedRun()?.position).toBe(1);
        // Three buttons share the row: Back and Next are arrows, still named
        // for screen readers, so Check keeps its room in a long language.
        expect(screen.getByLabelText("Next")).toBeTruthy();
        expect(screen.queryByText("Next")).toBeNull();
        expect(screen.queryByText("Back")).toBeNull();

        // Passed without answering it again.
        await user.press(screen.getByLabelText("Next"));
        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
        expect(screen.queryByLabelText("Next")).toBeNull();
        expect(savedRun()?.position).toBe(1);
    });

    it("grades a look back but keeps the first answer on record", async () => {
        withScreenReader(false);
        const { user } = await startLesson();

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));
        await user.press(screen.getByText("Continue"));
        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
        const recorded = savedRun();

        await user.press(screen.getByLabelText("Back"));
        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        const wrongTile = ["Picture 1 of 3", "Picture 2 of 3", "Picture 3 of 3"].find(
            (item) => item !== answerTileLabel(),
        )!;
        await user.press(screen.getByLabelText(wrongTile));
        await user.press(screen.getByText("Check"));

        expect(screen.getByText("Not quite")).toBeTruthy();
        expect(savedRun()?.records).toEqual(recorded?.records);
        expect(savedRun()?.queue).toEqual(recorded?.queue);
        await user.press(screen.getByText("OK"));
        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
    });

    it("goes back from the results to the last exercise, and on to the results again", async () => {
        withScreenReader(false);
        saveRunEndingOnPicture();
        const user = userEvent.setup();
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));
        await user.press(screen.getByText("Finish"));
        await waitFor(() => expect(screen.getByText("Exercises done!")).toBeTruthy());

        await user.press(screen.getByLabelText("Back"));
        await waitFor(() => expect(screen.getByText("Which one is this?")).toBeTruthy());
        await user.press(screen.getByLabelText("Next"));
        await waitFor(() => expect(screen.getByText("Exercises done!")).toBeTruthy());
        // Looking back is not finishing the lesson a second time.
        expect(getProgressData().progress.lessons["mrt-basics"].runs).toBe(1);
    });

    it("steps back from a finished lesson into its exercises, and returns to it", async () => {
        withScreenReader(false);
        completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
        const user = userEvent.setup();
        render(<LessonScreen />);

        await waitFor(() => expect(screen.getByText("Exercises done!")).toBeTruthy());
        await user.press(screen.getByLabelText("Back"));
        // The last exercise, with every one before it there to step through.
        await waitFor(() => expect(screen.getByLabelText("Next")).toBeTruthy());
        expect(screen.queryByText("Exercises done!")).toBeNull();
        expect(screen.queryByLabelText("Restart lesson")).toBeNull();

        await user.press(screen.getByLabelText("Next"));
        await waitFor(() => expect(screen.getByText("Exercises done!")).toBeTruthy());
        // A review keeps nothing and records nothing.
        expect(savedRun()).toBeUndefined();
        expect(getProgressData().progress.lessons["mrt-basics"]).toMatchObject({
            runs: 1,
            bestFirstTry: 7,
        });
    });

    it("has no Back on the daily mix's first exercise, which has no word list", async () => {
        // Rendered through the same screen with the mix's id.
        withScreenReader(false);
        const { getLesson } = jest.requireActual("@/lib/lessons/data");
        const { DAILY_MIX_ID } = jest.requireActual("@/lib/lessons/data/review");
        expect(getLesson(DAILY_MIX_ID)).toBeDefined();
        const router = jest.requireMock("expo-router");
        const params = jest.spyOn(router, "useLocalSearchParams").mockReturnValue({
            id: DAILY_MIX_ID,
        });
        render(<LessonScreen />);

        // Straight into the first exercise, whatever today's mix opens with.
        await waitFor(() => expect(screen.getByLabelText("Lesson progress")).toBeTruthy());
        expect(screen.queryByText("Words in this lesson")).toBeNull();
        expect(screen.queryByLabelText("Back")).toBeNull();
        params.mockRestore();
    });
});

describe("starting a lesson again", () => {
    it("is offered once there is an answer to lose, and asks first", async () => {
        withScreenReader(false);
        const { user } = await startLesson();

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        expect(screen.queryByLabelText("Restart lesson")).toBeNull();
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));

        await user.press(screen.getByLabelText("Restart lesson"));
        // Asked in place of the footer, with keeping going as the easy choice.
        expect(screen.getByText("Start this lesson again?")).toBeTruthy();
        expect(screen.queryByText("Continue")).toBeNull();
        await user.press(screen.getByText("Keep going"));
        expect(screen.queryByText("Start this lesson again?")).toBeNull();
        expect(screen.getByText("Continue")).toBeTruthy();
        expect(savedRun()?.position).toBe(1);
    });

    it("goes back to the first exercise and forgets the saved place", async () => {
        withScreenReader(false);
        const { user } = await startLesson();

        await waitFor(() => expect(screen.getByLabelText("Picture 1 of 3")).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));
        await user.press(screen.getByText("Continue"));
        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
        expect(savedRun()).toBeDefined();

        await user.press(screen.getByLabelText("Restart lesson"));
        await user.press(screen.getByText("Start again"));

        await waitFor(() => expect(screen.getByText("Which one is this?")).toBeTruthy());
        expect(screen.queryByText("Correct!")).toBeNull();
        expect(screen.getByLabelText("Check").props.accessibilityState?.disabled).toBe(true);
        expect(progressShown()).toBe(0);
        expect(savedRun()).toBeUndefined();
        // Nothing answered in the new run, so nothing to lose yet.
        expect(screen.queryByLabelText("Restart lesson")).toBeNull();
    });

    it("draws the first exercise afresh when started again on it", async () => {
        // Starting again from the feedback of the first answer lands on the
        // same exercise in the same place. Matching keeps its pairs to itself,
        // so without a fresh component every pair would still be matched and
        // the exercise could never be finished again. Under a screen reader the
        // pairs come first.
        withScreenReader(true);
        const { user } = await startLesson();
        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
        const pairs = mrtBasics.exercises.find((item) => item.id === "ex-1-pairs")!;
        const vocab = pairs.type === "matchPairs" ? pairs.vocabIds : [];
        const items = mrtBasics.vocab.filter((item) => vocab.includes(item.id));
        expect(items.length).toBeGreaterThan(1);
        for (const item of items) {
            await user.press(screen.getByText(item.term));
            await user.press(screen.getByText(item.meaning.en!));
        }
        await waitFor(() => expect(screen.getByText("Continue")).toBeTruthy());
        const used = (term: string) =>
            screen.getByLabelText(term).props.accessibilityState?.disabled === true;
        expect(items.every((item) => used(item.term))).toBe(true);

        await user.press(screen.getByLabelText("Restart lesson"));
        await user.press(screen.getByText("Start again"));

        await waitFor(() => expect(screen.queryByText("Continue")).toBeNull());
        expect(items.some((item) => used(item.term))).toBe(false);
        // Leaving now does not bring the old run back.
        setResume(null);
        expect(savedRun()).toBeUndefined();
    });
});

describe("what a learner is told, and where they land", () => {
    const picture = mrtBasics.exercises.find((item) => item.type === "selectPicture")!.id;
    const fill = mrtBasics.exercises.find(
        (item): item is FillBlankExercise => item.type === "fillBlank",
    )!;
    const queue = () => buildQueue(mrtBasics.exercises, "en");

    /** A run with everything answered but `last`, which is on screen. */
    function runEndingOn(
        last: string,
        { missed = [], requeued = [] }: { missed?: string[]; requeued?: string[] } = {},
    ) {
        const others = queue().filter((id) => id !== last || requeued.includes(id));
        saveRun("mrt-basics", {
            fingerprint: fingerprint(mrtBasics),
            locale: "en",
            screenReader: false,
            queue: [...others, last],
            position: others.length,
            records: Object.fromEntries(
                others.map((id) => [id, { attempts: 1, firstTryCorrect: !missed.includes(id) }]),
            ),
            requeued,
        });
    }

    it("shows an exercise missed and shown again with its options in another order", async () => {
        withScreenReader(false);
        runEndingOn(fill.id, { missed: [fill.id], requeued: [fill.id] });
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByText("Fill in the missing word")).toBeTruthy());

        const labels = new Set(fill.choices.map((choice) => choice.label));
        const shown = screen
            .getAllByRole("button")
            .map((button) => button.props.accessibilityLabel)
            .filter((label) => labels.has(label));
        // Answered by knowing it, not by where its tile was a moment ago.
        expect(shown).toEqual(retryOrder(fill.choices, fill.id, true).map((item) => item.label));
        expect(shown).not.toEqual(fill.choices.map((choice) => choice.label));
    });

    it("says what the right answer was after a miss, not another way to say it", async () => {
        withScreenReader(false);
        runEndingOn(fill.id, { missed: [fill.id], requeued: [fill.id] });
        const user = userEvent.setup();
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByText("Fill in the missing word")).toBeTruthy());
        const wrong = fill.choices.find((choice) => choice.id !== fill.correctChoiceId)!;
        await user.press(screen.getByLabelText(wrong.label));
        await user.press(screen.getByText("Check"));

        await waitFor(() => expect(screen.getByText("Not quite")).toBeTruthy());
        expect(screen.getByText(/The right answer:/)).toBeTruthy();
        expect(screen.queryByText(/You can also say:/)).toBeNull();
    });

    it("does not call a run with a slip in its matching right first time", async () => {
        withScreenReader(false);
        runEndingOn(picture, { missed: ["ex-1-pairs"] });
        const user = userEvent.setup();
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByLabelText(answerTileLabel())).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));
        await user.press(screen.getByText("Finish"));

        await waitFor(() => expect(screen.getByText("Exercises done!")).toBeTruthy());
        // Nothing came round again, but one answer was not right first time.
        expect(screen.queryByText("You got everything right the first time.")).toBeNull();
        expect(screen.queryByText(/Questions you tried again/)).toBeNull();
        const total = queue().length;
        expect(screen.getByText(`${total - 1} of ${total}`)).toBeTruthy();
    });

    it("opens a lesson just finished on its results when gone back past its first exercise", async () => {
        withScreenReader(false);
        runEndingOn(picture);
        const user = userEvent.setup();
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByLabelText(answerTileLabel())).toBeTruthy());
        await user.press(screen.getByLabelText(answerTileLabel()));
        await user.press(screen.getByText("Check"));
        await user.press(screen.getByText("Finish"));
        await waitFor(() => expect(screen.getByText("Speak later")).toBeTruthy());

        // Back through every exercise and past the first.
        for (let step = 0; step < 30; step++) {
            if (screen.queryByText("Start") || screen.queryByText("Practise again")) break;
            await user.press(screen.getByLabelText("Back"));
        }
        // Not the word list and Start, as if the lesson had never been done.
        expect(screen.queryByText("Start")).toBeNull();
        expect(screen.getByText("Practise again")).toBeTruthy();
        expect(screen.getByText("Exercises done!")).toBeTruthy();
    });

    it("says Continue on a finished lesson's page when another go is part-way through", async () => {
        withScreenReader(false);
        completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
        completeSpeaking("mrt-basics", { said: 3, total: 3 });
        const order = queue();
        saveRun("mrt-basics", {
            fingerprint: fingerprint(mrtBasics),
            locale: "en",
            screenReader: false,
            queue: order,
            position: 1,
            records: { [order[0]]: { attempts: 1, firstTryCorrect: true } },
            requeued: [],
        });
        const user = userEvent.setup();
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());

        await user.press(screen.getByLabelText("Back"));
        await user.press(screen.getByLabelText("Back"));
        await waitFor(() => expect(screen.getByText("Lesson done!")).toBeTruthy());
        // The button carries on with that go, and says so.
        expect(screen.queryByText("Practise again")).toBeNull();
        await user.press(screen.getByText("Continue"));
        await waitFor(() => expect(screen.getByText("Tap the pairs")).toBeTruthy());
    });

    it("does not promise Continue for a go that cannot be picked up again", async () => {
        // The go was kept before a screen reader was switched on, so it starts afresh.
        withScreenReader(true);
        completeLesson("mrt-basics", { firstTryCorrect: 7, total: 9 });
        completeSpeaking("mrt-basics", { said: 3, total: 3 });
        const order = queue();
        saveRun("mrt-basics", {
            fingerprint: fingerprint(mrtBasics),
            locale: "en",
            screenReader: false,
            queue: order,
            position: 1,
            records: { [order[0]]: { attempts: 1, firstTryCorrect: true } },
            requeued: [],
        });
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByText("Lesson done!")).toBeTruthy());
        expect(screen.getByText("Practise again")).toBeTruthy();
        expect(screen.queryByText("Continue")).toBeNull();
    });
});
