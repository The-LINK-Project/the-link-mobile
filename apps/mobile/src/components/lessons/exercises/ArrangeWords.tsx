import { useMemo } from "react";

import { WordBank } from "@/components/lessons/WordBank";
import { useTranslations } from "@/lib/i18n";
import { seededShuffle } from "@/lib/lessons/shuffle";
import type { ArrangeWordsExercise } from "@/lib/lessons/types";

import { tokenIndices, type ExerciseProps } from "./shared";

/**
 * Put a shuffled English sentence back in order.
 *
 * The tile list includes decoys, so the learner cannot succeed by using every
 * word offered. Graded on keywords rather than exact order: a sentence with the
 * right words in a different arrangement still communicates, which is the bar
 * this product is aiming at.
 */
export function ArrangeWords({
    exercise,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<ArrangeWordsExercise>) {
    const t = useTranslations("mobile.lessons");
    const tokens = useMemo(
        () => seededShuffle(exercise.tokens, exercise.id),
        [exercise.id, exercise.tokens],
    );
    const placed = draft?.kind === "tokens" ? tokenIndices(draft.tokens, tokens) : [];

    return (
        <WordBank
            tokens={tokens}
            placed={placed}
            disabled={locked}
            placeholder={t("buildSentence")}
            outcome={result ? (result.correct ? "correct" : "incorrect") : undefined}
            onChange={(next) =>
                onDraftChange(
                    next.length === 0
                        ? null
                        : { kind: "tokens", tokens: next.map((i) => tokens[i]) },
                )
            }
        />
    );
}
