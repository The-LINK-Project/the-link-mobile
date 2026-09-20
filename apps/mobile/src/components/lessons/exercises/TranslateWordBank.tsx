import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { PromptCard } from "@/components/lessons/PromptCard";
import { WordBank } from "@/components/lessons/WordBank";
import { Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { useFirstLanguageLocalized } from "@/lib/lessons/localized";
import { exercisePicture } from "@/lib/lessons/lookup";
import { seededShuffle } from "@/lib/lessons/shuffle";
import type { TranslateWordBankExercise } from "@/lib/lessons/types";
import { spacing } from "@/lib/theme";

import { tokenIndices, type ExerciseProps } from "./shared";

/**
 * Say something in English, prompted in the learner's own language.
 *
 * This is the hardest thing in the lesson: full production with no English on
 * screen to copy from. Answered with tiles rather than a keyboard, and graded
 * on keywords so word order and articles do not decide the outcome while
 * unrelated decoy tiles are still rejected.
 */
export function TranslateWordBank({
    exercise,
    lesson,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<TranslateWordBankExercise>) {
    const t = useFirstLanguageInterface("lessons");
    const localized = useFirstLanguageLocalized();
    const tokens = useMemo(
        () => seededShuffle(exercise.tokens, exercise.id),
        [exercise.id, exercise.tokens],
    );
    const placed = draft?.kind === "tokens" ? tokenIndices(draft.tokens, tokens) : [];

    return (
        <View style={styles.container}>
            <PromptCard picture={exercisePicture(lesson, exercise)}>
                <Text variant="heading">{localized(exercise.prompt)}</Text>
            </PromptCard>

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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl },
});
