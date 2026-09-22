/**
 * Render tests for the exercise components.
 *
 * These cover the wiring between a component and the session, which is where
 * the worst bug so far lived: the Check button was handing its press event to
 * the grader instead of the learner's answer, so every reducer test passed
 * while every exercise was broken. Logic tests alone cannot see that.
 */

import { act, render, screen, userEvent } from "@testing-library/react-native";

import { ArrangeWords } from "@/components/lessons/exercises/ArrangeWords";
import { FillBlank } from "@/components/lessons/exercises/FillBlank";
import { ListenChooseMeaning } from "@/components/lessons/exercises/ListenChooseMeaning";
import { TapThePairs } from "@/components/lessons/exercises/TapThePairs";
import { TranslateWordBank } from "@/components/lessons/exercises/TranslateWordBank";
import { LessonFooter } from "@/components/lessons/LessonFooter";
import { resetFirstLanguageForTests } from "@/lib/firstLanguage/store";
import { setLocale } from "@/lib/i18n";
import { mrtBasics } from "@/lib/lessons/data/mrt-basics";
import type {
    ArrangeWordsExercise,
    FillBlankExercise,
    ListenChooseMeaningExercise,
    MatchPairsExercise,
    TranslateWordBankExercise,
} from "@/lib/lessons/types";

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

const byType = <T extends { type: string }>(type: string) =>
    mrtBasics.exercises.find((exercise) => exercise.type === type) as unknown as T;

const pairsExercise = byType<MatchPairsExercise>("matchPairs");
const listenExercise = byType<ListenChooseMeaningExercise>("listenChooseMeaning");
const arrangeExercise = byType<ArrangeWordsExercise>("arrangeWords");
const translateExercise = byType<TranslateWordBankExercise>("translateWordBank");
const fillExercise = byType<FillBlankExercise>("fillBlank");

/** Props shared by every exercise, with the handlers stubbed out. */
function baseProps() {
    return {
        lesson: mrtBasics,
        draft: null,
        onDraftChange: jest.fn(),
        onSelfSubmit: jest.fn(),
        result: null,
        locked: false,
    };
}

beforeEach(async () => {
    resetFirstLanguageForTests();
    await act(() => setLocale("en"));
});

describe("TapThePairs", () => {
    it("shows the English terms and their meanings", () => {
        render(<TapThePairs exercise={pairsExercise} {...baseProps()} />);

        expect(screen.getByText("platform")).toBeTruthy();
        expect(screen.getByText("where you wait for the train")).toBeTruthy();
    });

    it("does not highlight a term's own translation when the term is tapped", async () => {
        // Regression: both columns are keyed by the same pair id, so selecting
        // by id alone lit up the answer in the other column.
        const user = userEvent.setup();
        render(<TapThePairs exercise={pairsExercise} {...baseProps()} />);

        await user.press(screen.getByText("platform"));

        const meaning = screen.getByLabelText("where you wait for the train");
        expect(meaning.props.accessibilityState?.selected).not.toBe(true);
        expect(screen.getByLabelText("platform").props.accessibilityState?.selected).toBe(true);
    });

    it("reports the exercise as done once every pair is matched", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(<TapThePairs exercise={pairsExercise} {...props} />);

        for (const item of pairsExercise.vocabIds) {
            const vocab = mrtBasics.vocab.find((entry) => entry.id === item)!;
            await user.press(screen.getByText(vocab.term));
            await user.press(screen.getByText(vocab.meaning.en));
        }

        expect(props.onSelfSubmit).toHaveBeenCalledWith({ kind: "pairs", wrongAttempts: 0 });
    });

    it("counts a wrong pairing without failing the exercise", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(<TapThePairs exercise={pairsExercise} {...props} />);

        // Mismatch on purpose, then wait out the rejection pause.
        await user.press(screen.getByText("platform"));
        await user.press(screen.getByText("get off the train"));
        expect(props.onSelfSubmit).not.toHaveBeenCalled();
    });

    it("follows a language change", async () => {
        // This exercise shows only lesson content, so nothing else would make
        // it re-render when the learner switches language.
        render(<TapThePairs exercise={pairsExercise} {...baseProps()} />);
        expect(screen.getByText("where you wait for the train")).toBeTruthy();

        await act(() => setLocale("bn"));

        expect(screen.getByText("যেখানে ট্রেনের জন্য অপেক্ষা করেন")).toBeTruthy();
        expect(screen.queryByText("where you wait for the train")).toBeNull();
    });
});

describe("ListenChooseMeaning", () => {
    it("does not show the English word before it is answered", () => {
        render(<ListenChooseMeaning exercise={listenExercise} {...baseProps()} />);
        expect(screen.queryByText(listenExercise.audioText)).toBeNull();
    });

    it("speaks the phrase when the play button is pressed", async () => {
        const user = userEvent.setup();
        const Speech = jest.requireMock("expo-speech");
        render(<ListenChooseMeaning exercise={listenExercise} {...baseProps()} />);

        await user.press(screen.getByLabelText("Listen"));

        expect(Speech.speak).toHaveBeenCalledWith(
            listenExercise.audioText,
            expect.objectContaining({ rate: expect.any(Number) }),
        );
    });

    it("reports the chosen option as a draft answer", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(<ListenChooseMeaning exercise={listenExercise} {...props} />);

        await user.press(screen.getByText("wait for the next train"));

        expect(props.onDraftChange).toHaveBeenCalledWith({
            kind: "choice",
            choiceId: "c-wrong-2",
        });
    });

    it("offers no option that sounds like the audio", () => {
        render(<ListenChooseMeaning exercise={listenExercise} {...baseProps()} />);
        // "Add money to your card" is the meaning of "top up", a near-homophone
        // of "tap out", and made this a pronunciation trap.
        expect(screen.queryByText("Add money to your card")).toBeNull();
    });
});

describe("word bank", () => {
    it("keeps a used tile in place instead of reflowing the bank", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        const { rerender } = render(<ArrangeWords exercise={arrangeExercise} {...props} />);

        await user.press(screen.getByText("dollars"));
        expect(props.onDraftChange).toHaveBeenCalledWith({ kind: "tokens", tokens: ["dollars"] });

        rerender(
            <ArrangeWords
                exercise={arrangeExercise}
                {...props}
                draft={{ kind: "tokens", tokens: ["dollars"] }}
            />,
        );

        // Two tiles now read "dollars": the placed one and the dimmed original.
        const tiles = screen.getAllByLabelText("dollars");
        expect(tiles).toHaveLength(2);
        expect(tiles.some((tile) => tile.props.accessibilityState?.disabled)).toBe(true);
    });

    it("removes a placed word when it is tapped again", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(
            <ArrangeWords
                exercise={arrangeExercise}
                {...props}
                draft={{ kind: "tokens", tokens: ["ten", "dollars"] }}
            />,
        );

        // The first "ten" is the placed tile in the answer row.
        await user.press(screen.getAllByLabelText("ten")[0]);

        expect(props.onDraftChange).toHaveBeenCalledWith({ kind: "tokens", tokens: ["dollars"] });
    });

    it("clears the draft when the last word is removed", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(
            <ArrangeWords
                exercise={arrangeExercise}
                {...props}
                draft={{ kind: "tokens", tokens: ["ten"] }}
            />,
        );

        await user.press(screen.getAllByLabelText("ten")[0]);

        expect(props.onDraftChange).toHaveBeenCalledWith(null);
    });

    it("shows the prompt in the learner's language", async () => {
        render(<TranslateWordBank exercise={translateExercise} {...baseProps()} />);
        expect(screen.getByText(translateExercise.prompt.en)).toBeTruthy();

        await act(() => setLocale("ta"));

        expect(screen.getByText(translateExercise.prompt.ta!)).toBeTruthy();
    });
});

describe("FillBlank", () => {
    it("reports the chosen word and marks the answer after grading", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        const { rerender } = render(<FillBlank exercise={fillExercise} {...props} />);

        await user.press(screen.getByText("in"));
        expect(props.onDraftChange).toHaveBeenCalledWith({ kind: "choice", choiceId: "f-in" });

        rerender(
            <FillBlank
                exercise={fillExercise}
                {...props}
                draft={{ kind: "choice", choiceId: "f-in" }}
                result={{ correct: false, modelAnswer: "out" }}
                locked
            />,
        );

        // The right answer is shown alongside what the learner picked.
        expect(screen.getByText("out")).toBeTruthy();
        expect(screen.getByLabelText("in").props.accessibilityState?.disabled).toBe(true);
    });
});

describe("LessonFooter", () => {
    const footerProps = () => ({
        phase: "answering" as const,
        canSubmit: true,
        result: null,
        onSubmit: jest.fn(),
        onNext: jest.fn(),
        isLastStep: false,
    });

    it("submits with no arguments, so a press event cannot be graded", async () => {
        // The regression that broke every Check-graded exercise: wiring the
        // handler straight to onPress passed the press event as the answer.
        const user = userEvent.setup();
        const props = footerProps();
        render(<LessonFooter {...props} />);

        await user.press(screen.getByText("Check"));

        expect(props.onSubmit).toHaveBeenCalledTimes(1);
        expect(props.onSubmit).toHaveBeenCalledWith();
    });

    it("does not offer Check until there is an answer", () => {
        render(<LessonFooter {...footerProps()} canSubmit={false} />);
        expect(screen.getByLabelText("Check").props.accessibilityState?.disabled).toBe(true);
    });

    it("states the outcome in words, not only in colour", () => {
        render(
            <LessonFooter
                {...footerProps()}
                phase="graded"
                result={{ correct: false, modelAnswer: "out" }}
            />,
        );

        // Audits found Duolingo's red and green nearly identical under common
        // colour blindness, so correctness has to be readable.
        expect(screen.getByText("Not quite")).toBeTruthy();
        expect(screen.getByText("out")).toBeTruthy();
        expect(screen.getByText("OK")).toBeTruthy();
    });

    it("acknowledges an accepted answer without calling it wrong", () => {
        render(
            <LessonFooter
                {...footerProps()}
                phase="graded"
                result={{
                    correct: true,
                    accepted: true,
                    modelAnswer: "I want to top up ten dollars",
                }}
            />,
        );

        expect(screen.getByText("Good, we understand you")).toBeTruthy();
        expect(screen.getByText("I want to top up ten dollars")).toBeTruthy();
    });

    it("shows no model answer when there is nothing better to offer", () => {
        // Matching has no model answer: finishing means every pair was right.
        render(
            <LessonFooter
                {...footerProps()}
                phase="graded"
                result={{ correct: true, accepted: true, modelAnswer: "" }}
            />,
        );

        expect(screen.queryByText("You can also say:")).toBeNull();
    });

    it("hides the Check button for a self-grading exercise", () => {
        render(<LessonFooter {...footerProps()} hideSubmit />);
        expect(screen.queryByText("Check")).toBeNull();
    });
});
