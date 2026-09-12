import { StyleSheet, View } from "react-native";

import { SpeakerButton } from "@/components/lessons/SpeakerButton";
import { Tile } from "@/components/lessons/Tile";
import { Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { useLocalized } from "@/lib/lessons/localized";
import { choiceText } from "@/lib/lessons/lookup";
import { useSpeech } from "@/lib/lessons/speech";
import type { ListenChooseMeaningExercise } from "@/lib/lessons/types";
import { spacing } from "@/lib/theme";

import { choiceTileState, type ExerciseProps } from "./shared";

/**
 * Hear an English term, choose what it means. The choices are in the learner's
 * own language, so this tests whether the spoken word was understood rather
 * than whether they can read English.
 *
 * The English text is never shown before answering — that would make it a
 * reading exercise. It appears in the feedback footer afterwards.
 */
export function ListenChooseMeaning({
    exercise,
    lesson,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<ListenChooseMeaningExercise>) {
    const t = useTranslations("mobile.lessons");
    const localized = useLocalized();
    const { speak, speaking, hasPlayed } = useSpeech();
    const chosen = draft?.kind === "choice" ? draft.choiceId : null;

    return (
        <View style={styles.container}>
            <SpeakerButton
                onPlay={() => speak(exercise.audioText, "normal")}
                onPlaySlow={() => speak(exercise.audioText, "slow")}
                speaking={speaking}
                hasPlayed={hasPlayed}
                disabled={locked}
            />

            {/* Without this, a learner who has never used an app like this has no
          cue that the circle is the thing to press. */}
            {hasPlayed ? null : (
                <Text variant="caption" center>
                    {t("tapToListen")}
                </Text>
            )}

            <View style={styles.choices}>
                {exercise.choices.map((choice) => {
                    const isChosen = chosen === choice.id;
                    const isAnswer = choice.id === exercise.correctChoiceId;
                    return (
                        <Tile
                            key={choice.id}
                            label={localized(choiceText(lesson, choice))}
                            block
                            state={choiceTileState({
                                graded: result !== null,
                                isChosen,
                                isAnswer,
                            })}
                            disabled={locked}
                            onPress={() => onDraftChange({ kind: "choice", choiceId: choice.id })}
                        />
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl, alignItems: "stretch" },
    choices: { gap: spacing.md },
});
