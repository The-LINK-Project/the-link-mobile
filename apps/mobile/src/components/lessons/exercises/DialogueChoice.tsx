import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Tile } from "@/components/lessons/Tile";
import { Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { useLocalized } from "@/lib/lessons/localized";
import { dialogueReplies } from "@/lib/lessons/lookup";
import { seededShuffle } from "@/lib/lessons/shuffle";
import { useSpeech } from "@/lib/lessons/speech";
import type { DialogueChoiceExercise } from "@/lib/lessons/types";
import { colors, radius, spacing, TOUCH_TARGET } from "@/lib/theme";

import { choiceTileState, type ExerciseProps } from "./shared";

/**
 * Somebody says something; the learner picks what to say back.
 *
 * The other person's line sits in a speech bubble with a speaker, its English
 * on top and its meaning underneath, so the learner is never stuck on a line
 * they cannot read. Every reply carries its meaning too. What is being taught
 * is which sentence fits the moment, which is the step just before saying it
 * aloud to the tutor.
 */
export function DialogueChoice({
    exercise,
    lesson,
    draft,
    onDraftChange,
    result,
    locked,
}: ExerciseProps<DialogueChoiceExercise>) {
    const t = useTranslations("mobile.lessons");
    const localized = useLocalized();
    const { speak, speaking } = useSpeech();
    const chosen = draft?.kind === "choice" ? draft.choiceId : null;
    const replies = useMemo(
        () => seededShuffle(dialogueReplies(lesson, exercise), exercise.id),
        [lesson, exercise],
    );

    return (
        <View style={styles.container}>
            <Text variant="caption">{localized(exercise.situation)}</Text>

            <View style={styles.bubbleRow}>
                <View style={styles.avatar}>
                    <Ionicons name="person" size={22} color={colors.primaryDark} />
                </View>
                <View style={styles.bubble}>
                    <Text variant="bodyStrong">{exercise.line}</Text>
                    <Text variant="caption">{localized(exercise.lineMeaning)}</Text>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("play")}
                    accessibilityState={{ disabled: !!locked, busy: speaking }}
                    disabled={locked}
                    onPress={() => speak(exercise.line, "normal")}
                    style={({ pressed }) => [
                        styles.speaker,
                        pressed && !locked ? styles.pressed : null,
                        locked ? styles.disabled : null,
                    ]}
                >
                    {speaking ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Ionicons name="volume-high" size={24} color={colors.white} />
                    )}
                </Pressable>
            </View>

            <Text variant="caption">{t("yourReply")}</Text>

            <View style={styles.choices}>
                {replies.map((reply) => (
                    <Tile
                        key={reply.id}
                        label={reply.text}
                        caption={localized(reply.meaning)}
                        block
                        state={choiceTileState({
                            graded: result !== null,
                            isChosen: chosen === reply.id,
                            isAnswer: reply.id === exercise.phraseId,
                        })}
                        disabled={locked}
                        onPress={() => onDraftChange({ kind: "choice", choiceId: reply.id })}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.lg },
    bubbleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
    },
    bubble: {
        flex: 1,
        gap: spacing.xs,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderTopLeftRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    speaker: {
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
    },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
    choices: { gap: spacing.md },
});
