/**
 * Render tests for the picture-to-word, listen-and-build and dialogue exercises.
 *
 * As with the older exercises, what matters is the join to the session: the
 * answer reported upwards is the one the learner tapped, in the shape the
 * grader expects, and nothing gives the answer away before it is graded.
 */

import { act, render, screen, userEvent } from "@testing-library/react-native";

import { DialogueChoice } from "@/components/lessons/exercises/DialogueChoice";
import { ListenArrangeWords } from "@/components/lessons/exercises/ListenArrangeWords";
import { PictureToWord } from "@/components/lessons/exercises/PictureToWord";
import { setLocale } from "@/lib/i18n";
import { mrtBasics } from "@/lib/lessons/data/mrt-basics";
import { phraseById } from "@/lib/lessons/lookup";
import type {
    DialogueChoiceExercise,
    ListenArrangeWordsExercise,
    PictureToWordExercise,
} from "@/lib/lessons/types";

jest.mock("expo-speech", () => ({
    speak: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    getAvailableVoicesAsync: jest.fn().mockResolvedValue([]),
    VoiceQuality: { Default: "Default", Enhanced: "Enhanced" },
}));

const byType = <T extends { type: string }>(type: string) =>
    mrtBasics.exercises.find((exercise) => exercise.type === type) as unknown as T;

const pictureWord = byType<PictureToWordExercise>("pictureToWord");
const listenArrange = byType<ListenArrangeWordsExercise>("listenArrangeWords");
const dialogue = byType<DialogueChoiceExercise>("dialogueChoice");

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
    await act(() => setLocale("en"));
});

describe("PictureToWord", () => {
    it("offers the words as tiles and reports the tapped one", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(<PictureToWord exercise={pictureWord} {...props} />);

        for (const id of pictureWord.choiceVocabIds) {
            const term = mrtBasics.vocab.find((item) => item.id === id)!.term;
            expect(screen.getByText(term)).toBeTruthy();
        }
        await user.press(screen.getByText("platform"));
        expect(props.onDraftChange).toHaveBeenCalledWith({
            kind: "choice",
            choiceId: "v-platform",
        });
    });

    it("does not caption the picture with its word", () => {
        render(<PictureToWord exercise={pictureWord} {...baseProps()} />);
        // The answer appears exactly once: as a tile, never as a label on the prompt.
        expect(screen.getAllByText("exit")).toHaveLength(1);
    });
});

describe("ListenArrangeWords", () => {
    it("shows no sentence before it is built, and speaks it on request", async () => {
        const user = userEvent.setup();
        const Speech = jest.requireMock("expo-speech");
        render(<ListenArrangeWords exercise={listenArrange} {...baseProps()} />);

        const sentence = phraseById(mrtBasics, listenArrange.phraseId)!.text;
        expect(screen.queryByText(sentence)).toBeNull();
        expect(screen.getByText("Tap the words you heard")).toBeTruthy();

        await user.press(screen.getByLabelText("Listen"));
        expect(Speech.speak).toHaveBeenCalledWith(sentence, expect.anything());
    });

    it("reports placed tiles as a token answer", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(<ListenArrangeWords exercise={listenArrange} {...props} />);

        await user.press(screen.getByText("alight"));
        expect(props.onDraftChange).toHaveBeenCalledWith({ kind: "tokens", tokens: ["alight"] });
    });
});

describe("DialogueChoice", () => {
    it("shows the other person's line with its meaning, and every reply with its meaning", () => {
        render(<DialogueChoice exercise={dialogue} {...baseProps()} />);

        expect(screen.getByText(dialogue.line)).toBeTruthy();
        expect(screen.getByText(dialogue.lineMeaning.en)).toBeTruthy();
        const correct = phraseById(mrtBasics, dialogue.phraseId)!;
        expect(screen.getByText(correct.text)).toBeTruthy();
        expect(screen.getByText(correct.meaning.en)).toBeTruthy();
    });

    it("reports the chosen reply by its phrase id, so it grades against the phrase", async () => {
        const user = userEvent.setup();
        const props = baseProps();
        render(<DialogueChoice exercise={dialogue} {...props} />);

        await user.press(screen.getByText(phraseById(mrtBasics, dialogue.phraseId)!.text));
        expect(props.onDraftChange).toHaveBeenCalledWith({
            kind: "choice",
            choiceId: dialogue.phraseId,
        });
    });

    it("follows a language change in the meanings", async () => {
        render(<DialogueChoice exercise={dialogue} {...baseProps()} />);
        await act(() => setLocale("ta"));
        expect(screen.getByText(dialogue.situation.ta!)).toBeTruthy();
    });
});
