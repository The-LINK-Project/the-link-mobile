import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { WordBank } from "@/components/lessons/WordBank";
import { Card, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { useLocalized } from "@/lib/lessons/localized";
import { phraseById } from "@/lib/lessons/lookup";
import { spacing } from "@/lib/theme";
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
 *
 * What the sentence is for is shown above the tiles, in the learner's language.
 * Without it the learner is handed six English words and asked to guess which
 * sentence was meant, often a sentence they are meeting for the first time.
 * With it, the task is the real one: I know what I want to say, how does English
 * say it?
 */
export function ArrangeWords({
    exercise,
    lesson,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<ArrangeWordsExercise>) {
    const t = useTranslations("mobile.lessons");
    const localized = useLocalized();
    const phrase = phraseById(lesson, exercise.phraseId);
    const tokens = useMemo(
        () => seededShuffle(exercise.tokens, exercise.id),
        [exercise.id, exercise.tokens],
    );
    const placed = draft?.kind === "tokens" ? tokenIndices(draft.tokens, tokens) : [];

    return (
        <View style={styles.container}>
            {phrase ? (
                <Card tone="muted">
                    <Text variant="body">{localized(phrase.meaning)}</Text>
                </Card>
            ) : null}
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
