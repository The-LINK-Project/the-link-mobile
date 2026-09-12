/**
 * Lesson domain types.
 *
 * These shapes are deliberately written as if they had come back from
 * `GET /v1/lessons/:id`, so swapping the dummy data in `data/` for a real API
 * response is a change of source only — no screen or component needs to know.
 *
 * Adding a new exercise type means: add a variant to `Exercise`, add a grader
 * branch in `grading.ts`, and register a component in `ExerciseRenderer`.
 * Nothing else in the app should switch on exercise type.
 */

/** A supported learner language. Mirrors `Locale` in `lib/i18n`. */
export type LearnerLanguage = "en" | "bn" | "ta";

/**
 * Text the learner reads in their own language. `en` is required because it is
 * the fallback; the rest are filled in as translations land.
 */
export type Localized = { en: string } & Partial<Record<LearnerLanguage, string>>;

/** A vocabulary item the lesson teaches. */
export type VocabItem = {
    id: string;
    /** The English term being taught. */
    term: string;
    /** Plain-words gloss, shown on the intro screen and in feedback. */
    meaning: Localized;
    /**
     * False until a native speaker has checked the non-English strings on this
     * item. Surfaced in dev so untrusted copy cannot quietly ship.
     */
    reviewed: boolean;
};

/** A phrase the lesson wants the learner to be able to say. */
export type Phrase = {
    id: string;
    /** The target English phrase, in the register it is actually said in. */
    text: string;
    meaning: Localized;
    reviewed: boolean;
};

/** How an answer is judged. Defaults per type live in `grading.ts`. */
export type GradingRule =
    /** One choice must match the recorded correct id. */
    | { mode: "choice" }
    /** Every pair must be matched. Graded pair by pair as they are tapped. */
    | { mode: "pairs" }
    /**
     * Lenient: correct when all `keywords` appear, ignoring order, articles,
     * filler words and small spelling slips. This is the rule that lets
     * "I want go Jurong" count as understood.
     */
    | {
          mode: "keywords";
          keywords: string[];
          /** Extra words never required. */ ignore?: string[];
      };

type ExerciseBase = {
    id: string;
    /** Instruction shown above the exercise. */
    instruction: Localized;
    /** Vocab this exercise practises, used by the end-of-lesson summary. */
    practises: string[];
};

/**
 * Tap the pairs. Two columns; English on one side, the learner's language on
 * the other. Self-grading: each pair is judged the moment it is completed, so
 * this type never uses the Check button.
 */
export type MatchPairsExercise = ExerciseBase & {
    type: "matchPairs";
    /**
     * The vocabulary to pair up, by id. Terms and meanings are looked up in
     * `Lesson.vocab` rather than restated here, so a corrected translation
     * cannot go stale in one place while staying right in another.
     */
    vocabIds: string[];
    grading: { mode: "pairs" };
};

/**
 * Hear a term, choose what it means. Choices are in the learner's language,
 * so this tests comprehension rather than reading English.
 */
/**
 * One option in a meaning question.
 *
 * A meaning the lesson actually teaches references vocabulary by id, for the
 * same reason matching does. A distractor is not taught anywhere, so it carries
 * its own text. The two forms are mutually exclusive.
 */
export type MeaningChoice = { id: string } & (
    { vocabId: string; label?: never } | { label: Localized; vocabId?: never }
);

export type ListenChooseMeaningExercise = ExerciseBase & {
    type: "listenChooseMeaning";
    /** Text handed to text-to-speech. Never shown on screen before answering. */
    audioText: string;
    choices: MeaningChoice[];
    correctChoiceId: string;
    grading: { mode: "choice" };
};

/** Put a shuffled English sentence back in order by tapping tiles. */
export type ArrangeWordsExercise = ExerciseBase & {
    type: "arrangeWords";
    /** The model sentence, shown in feedback. */
    target: string;
    /** Tiles offered, already including any decoys. Presented shuffled. */
    tokens: string[];
    grading: GradingRule;
};

/** Prompt in the learner's language; build the English sentence from tiles. */
export type TranslateWordBankExercise = ExerciseBase & {
    type: "translateWordBank";
    prompt: Localized;
    target: string;
    tokens: string[];
    grading: GradingRule;
};

/** A sentence with one gap, filled by tapping one of a few tiles. */
export type FillBlankExercise = ExerciseBase & {
    type: "fillBlank";
    /** Sentence split into parts; `null` marks where the gap sits. */
    sentence: (string | null)[];
    choices: { id: string; label: string }[];
    correctChoiceId: string;
    grading: { mode: "choice" };
};

export type Exercise =
    | MatchPairsExercise
    | ListenChooseMeaningExercise
    | ArrangeWordsExercise
    | TranslateWordBankExercise
    | FillBlankExercise;

export type ExerciseType = Exercise["type"];

/** A note about how something works in Singapore, shown before the exercises. */
export type TopicNote = { id: string; text: Localized; reviewed: boolean };

export type Lesson = {
    id: string;
    title: Localized;
    /** One line on what the learner will be able to do afterwards. */
    goal: Localized;
    level: "beginner" | "intermediate";
    estimatedMinutes: number;
    notes: TopicNote[];
    vocab: VocabItem[];
    phrases: Phrase[];
    exercises: Exercise[];
};

/**
 * Which answer shape belongs to which exercise type.
 *
 * Exercise components are typed through `AnswerFor`, so a multiple-choice
 * exercise cannot produce a sentence answer or the reverse — the compiler
 * rejects it. The session reducer still stores the wider `Answer` union, since
 * it handles whatever is on screen, and validates the shape at runtime.
 */
export type AnswerByExercise = {
    matchPairs: {
        kind: "pairs";
        /** Wrong pairings before finishing. Never fails the exercise. */
        wrongAttempts: number;
    };
    listenChooseMeaning: { kind: "choice"; choiceId: string };
    fillBlank: { kind: "choice"; choiceId: string };
    /** Ordered list of the tiles the learner placed. */
    arrangeWords: { kind: "tokens"; tokens: string[] };
    translateWordBank: { kind: "tokens"; tokens: string[] };
};

export type AnswerFor<T extends ExerciseType> = AnswerByExercise[T];

/** Any answer, as stored by the session. */
export type Answer = AnswerByExercise[ExerciseType];

export type GradeResult = {
    correct: boolean;
    /** The model answer, always shown after grading. */
    modelAnswer: string;
    /**
     * What `modelAnswer` actually is, so feedback can label it correctly.
     *
     * For a listening exercise it is the English that was spoken, which the
     * learner never saw — revealing it teaches the word. Calling that "another
     * way to say it" would be wrong, since it is not a rephrasing of anything.
     */
    modelAnswerKind?: "answer" | "audio";
    /**
     * False when the exercise was completed but not cleanly, so the summary can
     * stop counting it as right first time. Matching sets this after a wrong
     * pairing: the exercise still passes, because a rejected pair is corrected
     * in the moment rather than failing the learner.
     */
    firstPassClean?: boolean;
    /**
     * Keywords the learner missed. Lets feedback say what was absent rather than
     * only restating the whole sentence.
     */
    missing?: string[];
    /**
     * True when the answer was accepted but not word-perfect, e.g. right words
     * in a different order. Feedback can acknowledge this without failing them.
     */
    accepted?: boolean;
};
