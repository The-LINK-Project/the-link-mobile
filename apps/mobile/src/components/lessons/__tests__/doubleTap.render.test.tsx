/**
 * A double tap on a lesson's footer, with the real guard (jest.setup stubs it
 * out for the other screen tests). The next step often puts a live button
 * exactly where the last one was, so the second tap must not count: one on
 * Finish used to skip the results for speaking, and one on Check graded the
 * answer and moved on before the learner had seen it.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import LessonScreen from "@/app/(app)/lesson/[id]";
import { SETTLE_MS } from "@/components/ui/PressGuard";
import { resetFirstLanguageForTests } from "@/lib/firstLanguage/store";
import { setLocale } from "@/lib/i18n";
import { mrtBasics } from "@/lib/lessons/data/mrt-basics";
import { picturableVocab } from "@/lib/lessons/lookup";
import { buildQueue, fingerprint } from "@/lib/lessons/session";
import { seededShuffle } from "@/lib/lessons/shuffle";
import type { SelectPictureExercise } from "@/lib/lessons/types";
import { saveRun } from "@/lib/progress/store";

jest.unmock("@/components/ui/PressGuard");

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

const picture = mrtBasics.exercises.find(
    (item): item is SelectPictureExercise => item.type === "selectPicture",
)!;

function answerTileLabel(): string {
    const order = seededShuffle(picturableVocab(mrtBasics, picture.choiceVocabIds), picture.id);
    const index = order.findIndex((item) => item.id === picture.vocabId);
    return `Picture ${index + 1} of ${order.length}`;
}

/** Let the footer settle, as a learner who is not double-tapping would. */
function settle() {
    act(() => {
        jest.advanceTimersByTime(SETTLE_MS);
    });
}

beforeEach(async () => {
    jest.useFakeTimers();
    resetFirstLanguageForTests();
    mockRouter.replace.mockClear();
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({
        remove: jest.fn(),
    } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
    await act(() => setLocale("en"));
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe("a double tap in a lesson", () => {
    it("on Check shows the answer rather than moving straight on", async () => {
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByText("Start")).toBeTruthy());
        settle();
        fireEvent.press(screen.getByText("Start"));
        await waitFor(() => expect(screen.getByLabelText(answerTileLabel())).toBeTruthy());
        fireEvent.press(screen.getByLabelText(answerTileLabel()));
        settle();

        fireEvent.press(screen.getByText("Check"));
        expect(screen.getByText("Correct!")).toBeTruthy();
        // The second tap lands on Continue, where Check was.
        fireEvent.press(screen.getByText("Continue"));
        expect(screen.getByText("Correct!")).toBeTruthy();
        expect(screen.queryByText("Tap the pairs")).toBeNull();

        settle();
        fireEvent.press(screen.getByText("Continue"));
        expect(screen.getByText("Tap the pairs")).toBeTruthy();
    });

    it("on Finish shows the results rather than skipping to speaking", async () => {
        const others = buildQueue(mrtBasics.exercises, "en").filter((id) => id !== picture.id);
        saveRun("mrt-basics", {
            fingerprint: fingerprint(mrtBasics),
            locale: "en",
            screenReader: false,
            queue: [...others, picture.id],
            position: others.length,
            records: Object.fromEntries(
                others.map((id) => [id, { attempts: 1, firstTryCorrect: true }]),
            ),
            requeued: [],
        });
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByLabelText(answerTileLabel())).toBeTruthy());
        fireEvent.press(screen.getByLabelText(answerTileLabel()));
        settle();
        fireEvent.press(screen.getByText("Check"));
        settle();

        fireEvent.press(screen.getByText("Finish"));
        expect(screen.getByText("Exercises done!")).toBeTruthy();
        // Practise speaking is now where Finish was.
        fireEvent.press(screen.getByText("Practise speaking"));
        expect(mockRouter.replace).not.toHaveBeenCalled();

        settle();
        fireEvent.press(screen.getByText("Practise speaking"));
        expect(mockRouter.replace).toHaveBeenCalledWith(
            expect.objectContaining({ pathname: "/speak/[id]" }),
        );
    });

    it("on Back steps back twice, for a learner going back quickly", async () => {
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByText("Start")).toBeTruthy());
        settle();
        fireEvent.press(screen.getByText("Start"));
        await waitFor(() => expect(screen.getByLabelText(answerTileLabel())).toBeTruthy());
        // Answer the first two exercises.
        fireEvent.press(screen.getByLabelText(answerTileLabel()));
        settle();
        fireEvent.press(screen.getByText("Check"));
        settle();
        fireEvent.press(screen.getByText("Continue"));
        expect(screen.getByText("Tap the pairs")).toBeTruthy();
        settle();

        // From the pairs: Back to the picture, and straight on Back again to
        // the word list, both taken.
        fireEvent.press(screen.getByLabelText("Back"));
        expect(screen.getByText("Which one is this?")).toBeTruthy();
        fireEvent.press(screen.getByLabelText("Back"));
        expect(screen.getByText("Words in this lesson")).toBeTruthy();
    });

    it("on the restart question lets it settle before it is answered", async () => {
        render(<LessonScreen />);
        await waitFor(() => expect(screen.getByText("Start")).toBeTruthy());
        settle();
        fireEvent.press(screen.getByText("Start"));
        await waitFor(() => expect(screen.getByLabelText(answerTileLabel())).toBeTruthy());
        fireEvent.press(screen.getByLabelText(answerTileLabel()));
        settle();
        fireEvent.press(screen.getByText("Check"));
        settle();

        fireEvent.press(screen.getByLabelText("Restart lesson"));
        expect(screen.getByText("Start this lesson again?")).toBeTruthy();
        fireEvent.press(screen.getByText("Start again"));
        expect(screen.getByText("Start this lesson again?")).toBeTruthy();
        settle();
        fireEvent.press(screen.getByText("Keep going"));
        expect(screen.queryByText("Start this lesson again?")).toBeNull();
        expect(screen.getByText("Correct!")).toBeTruthy();
    });
});
