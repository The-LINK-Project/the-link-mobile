import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { PictureTile } from "@/components/lessons/PictureTile";
import { SpeakerButton } from "@/components/lessons/SpeakerButton";
import { Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { picturableVocab, vocabByIds } from "@/lib/lessons/lookup";
import { seededShuffle } from "@/lib/lessons/shuffle";
import { useSpeech } from "@/lib/lessons/speech";
import type { SelectPictureExercise } from "@/lib/lessons/types";
import { spacing } from "@/lib/theme";

import { choiceTileState, type ExerciseProps } from "./shared";

/**
 * A word, and pictures to choose between.
 *
 * The one exercise that asks nothing of a learner's reading beyond the single
 * prompt word, which is also spoken. That makes it the right thing to open a
 * lesson with: Duolingo uses its equivalent as the session opener whenever new
 * vocabulary is introduced, on the reasoning that recognition should come
 * before production.
 *
 * Unlike Duolingo's version there is a speaker on the prompt. Theirs has none,
 * because their prompt is in a language the learner already reads. Here the
 * prompt is the English being taught, so hearing it is the point.
 */
export function SelectPicture({
    exercise,
    lesson,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<SelectPictureExercise>) {
    const t = useFirstLanguageInterface("lessons");
    const { speak, speaking, hasPlayed } = useSpeech();

    const [subject] = vocabByIds(lesson, [exercise.vocabId]);
    const choices = useMemo(
        () => seededShuffle(picturableVocab(lesson, exercise.choiceVocabIds), exercise.id),
        [lesson, exercise.choiceVocabIds, exercise.id],
    );

    const chosen = draft?.kind === "choice" ? draft.choiceId : null;

    return (
        <View style={styles.container}>
            <View style={styles.prompt}>
                <Text variant="display" center>
                    {subject?.term}
                </Text>
                <SpeakerButton
                    onPlay={() => speak(subject?.term ?? "", "normal")}
                    onPlaySlow={() => speak(subject?.term ?? "", "slow")}
                    speaking={speaking}
                    hasPlayed={hasPlayed}
                    disabled={locked}
                />
            </View>

            <View style={styles.choices}>
                {choices.map((choice, index) =>
                    choice.picture ? (
                        <PictureTile
                            key={choice.id}
                            picture={choice.picture}
                            state={choiceTileState({
                                graded: result !== null,
                                isChosen: chosen === choice.id,
                                isAnswer: choice.id === exercise.vocabId,
                            })}
                            disabled={locked}
                            position={t("optionPosition", {
                                index: index + 1,
                                total: choices.length,
                            })}
                            onPress={() => onDraftChange({ kind: "choice", choiceId: choice.id })}
                        />
                    ) : null,
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xxl },
    prompt: { alignItems: "center", gap: spacing.lg },
    choices: { flexDirection: "row", gap: spacing.md },
});
