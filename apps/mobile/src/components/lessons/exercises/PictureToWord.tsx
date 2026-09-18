import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { PictureArt } from "@/components/lessons/PictureTile";
import { Tile } from "@/components/lessons/Tile";
import { picturableVocab, vocabByIds } from "@/lib/lessons/lookup";
import { seededShuffle } from "@/lib/lessons/shuffle";
import type { PictureToWordExercise } from "@/lib/lessons/types";
import { spacing } from "@/lib/theme";

import { choiceTileState, type ExerciseProps } from "./shared";

/**
 * A picture, and English words to choose between.
 *
 * The reverse of the picture-choice exercise: the learner sees the thing and
 * has to find its name. That is recall rather than recognition, and it is the
 * direction a real counter demands, where nobody shows them the word first.
 */
export function PictureToWord({
    exercise,
    lesson,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<PictureToWordExercise>) {
    const [subject] = picturableVocab(lesson, [exercise.vocabId]);
    const choices = useMemo(
        () => seededShuffle(vocabByIds(lesson, exercise.choiceVocabIds), exercise.id),
        [lesson, exercise.choiceVocabIds, exercise.id],
    );

    const chosen = draft?.kind === "choice" ? draft.choiceId : null;

    return (
        <View style={styles.container}>
            <View style={styles.prompt}>
                {subject?.picture ? <PictureArt picture={subject.picture} /> : null}
            </View>

            <View style={styles.choices}>
                {choices.map((choice) => (
                    <Tile
                        key={choice.id}
                        label={choice.term}
                        block
                        state={choiceTileState({
                            graded: result !== null,
                            isChosen: chosen === choice.id,
                            isAnswer: choice.id === exercise.vocabId,
                        })}
                        disabled={locked}
                        onPress={() => onDraftChange({ kind: "choice", choiceId: choice.id })}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xxl },
    prompt: { alignItems: "center" },
    choices: { gap: spacing.md },
});
