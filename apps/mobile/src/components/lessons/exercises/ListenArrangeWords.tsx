import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { SpeakerButton } from "@/components/lessons/SpeakerButton";
import { WordBank } from "@/components/lessons/WordBank";
import { Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { phraseById } from "@/lib/lessons/lookup";
import { seededShuffle } from "@/lib/lessons/shuffle";
import { useSpeech } from "@/lib/lessons/speech";
import type { ListenArrangeWordsExercise } from "@/lib/lessons/types";
import { spacing } from "@/lib/theme";

import { tokenIndices, type ExerciseProps } from "./shared";

/**
 * Hear a sentence, then build it from tiles.
 *
 * Nothing is written on screen before the answer, so this is listening
 * practice for a whole sentence. The sentence itself is only revealed by the
 * feedback footer, labelled as what was heard.
 */
export function ListenArrangeWords({
    exercise,
    lesson,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<ListenArrangeWordsExercise>) {
    const t = useTranslations("mobile.lessons");
    const { speak, speaking, hasPlayed } = useSpeech();
    const sentence = phraseById(lesson, exercise.phraseId)?.text ?? "";
    const tokens = useMemo(
        () => seededShuffle(exercise.tokens, exercise.id),
        [exercise.id, exercise.tokens],
    );
    const placed = draft?.kind === "tokens" ? tokenIndices(draft.tokens, tokens) : [];

    return (
        <View style={styles.container}>
            <SpeakerButton
                onPlay={() => speak(sentence, "normal")}
                onPlaySlow={() => speak(sentence, "slow")}
                speaking={speaking}
                hasPlayed={hasPlayed}
                disabled={locked}
            />

            {hasPlayed ? null : (
                <Text variant="caption" center>
                    {t("tapToListen")}
                </Text>
            )}

            <WordBank
                tokens={tokens}
                placed={placed}
                disabled={locked}
                placeholder={t("buildHeard")}
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
    container: { gap: spacing.xl, alignItems: "stretch" },
});
