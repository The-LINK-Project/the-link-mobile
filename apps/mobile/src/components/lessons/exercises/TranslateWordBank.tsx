import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { WordBank } from "@/components/lessons/WordBank";
import { Card, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { useLocalized } from "@/lib/lessons/localized";
import { seededShuffle } from "@/lib/lessons/shuffle";
import type { TranslateWordBankExercise } from "@/lib/lessons/types";
import { spacing } from "@/lib/theme";

import { tokenIndices, type ExerciseProps } from "./shared";

/**
 * Say something in English, prompted in the learner's own language.
 *
 * This is the hardest thing in the lesson: full production with no English on
 * screen to copy from. Answered with tiles rather than a keyboard, and graded
 * on keywords so word order and articles do not decide the outcome.
 */
export function TranslateWordBank({
    exercise,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<TranslateWordBankExercise>) {
    const t = useTranslations("mobile.lessons");
    const localized = useLocalized();
    const tokens = useMemo(
        () => seededShuffle(exercise.tokens, exercise.id),
        [exercise.id, exercise.tokens],
    );
    const placed = draft?.kind === "tokens" ? tokenIndices(draft.tokens, tokens) : [];

    return (
        <View style={styles.container}>
            <Card>
                <Text variant="heading">{localized(exercise.prompt)}</Text>
            </Card>

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
