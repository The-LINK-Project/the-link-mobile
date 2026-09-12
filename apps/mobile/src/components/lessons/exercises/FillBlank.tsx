import { StyleSheet, View } from "react-native";

import { Tile } from "@/components/lessons/Tile";
import { Text } from "@/components/ui";
import type { FillBlankExercise } from "@/lib/lessons/types";
import { colors, radius, spacing } from "@/lib/theme";

import { choiceTileState, type ExerciseProps } from "./shared";

/**
 * A sentence with one gap, filled by tapping one of a few words.
 *
 * The lesson closes on this type on purpose. It is the easiest thing in the
 * run, so the learner finishes on something they get right rather than on the
 * hardest exercise in the lesson.
 */
export function FillBlank({
    exercise,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<FillBlankExercise>) {
    const chosen = draft?.kind === "choice" ? draft.choiceId : null;
    const chosenLabel = exercise.choices.find((choice) => choice.id === chosen)?.label;

    return (
        <View style={styles.container}>
            {/* The sentence reads as one line of text with the chosen word dropped
          into the gap, so the learner can check whether it sounds right. */}
            <Text variant="heading" style={styles.sentence}>
                {exercise.sentence.map((part, index) =>
                    part === null ? (
                        <Text key={`blank-${index}`} variant="heading" style={styles.blank}>
                            {chosenLabel ? ` ${chosenLabel} ` : "        "}
                        </Text>
                    ) : (
                        <Text key={`part-${index}`} variant="heading">
                            {index === 0 ? part : ` ${part}`}
                        </Text>
                    ),
                )}
            </Text>

            <View style={styles.choices}>
                {exercise.choices.map((choice) => {
                    const isChosen = chosen === choice.id;
                    const isAnswer = choice.id === exercise.correctChoiceId;
                    return (
                        <Tile
                            key={choice.id}
                            label={choice.label}
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
    container: { gap: spacing.xxl },
    sentence: { lineHeight: 36 },
    blank: {
        // Underlining the gap is what signals "something goes here".
        textDecorationLine: "underline",
        textDecorationColor: colors.border,
        color: colors.primaryDark,
        borderRadius: radius.sm,
    },
    choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "center" },
});
