import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { GradeResult } from "@/lib/lessons/types";
import { colors, spacing } from "@/lib/theme";

import { BackButton } from "./StepNav";

/**
 * The footer that grades the lesson: Check while answering, then the outcome
 * banner and Continue, with Back beside them to step to the exercise before.
 *
 * Correctness is carried by an icon and a word as well as colour. Audits of
 * Duolingo found their green and red feedback both fail contrast standards and
 * look nearly identical under the common forms of colour blindness, so hue is
 * treated here as reinforcement rather than as the message.
 */
type Props = {
    phase: "answering" | "graded";
    /** Whether a draft answer exists, so Check can be enabled. */
    canSubmit: boolean;
    result: GradeResult | null;
    onSubmit: () => void;
    onNext: () => void;
    /** Changes Continue to Finish on the final step. */
    isLastStep: boolean;
    /** Hidden for self-grading exercises, which advance on their own. */
    hideSubmit?: boolean;
    /** Steps back to the exercise before. Absent where there is nothing to go back to. */
    onBack?: () => void;
    /**
     * On an exercise already answered, after stepping back. It can be passed
     * without answering it again.
     */
    revisiting?: boolean;
};

export function LessonFooter({
    phase,
    canSubmit,
    result,
    onSubmit,
    onNext,
    isLastStep,
    hideSubmit,
    onBack,
    revisiting,
}: Props) {
    const t = useFirstLanguageInterface("lessons");
    const graded = phase === "graded" && result;

    // The reinforcement triad is sound, animation and haptic fired on the moment
    // of grading. Without audio assets yet, haptics carry the non-visual half.
    useEffect(() => {
        if (!graded) return;
        void Haptics.notificationAsync(
            result.correct
                ? Haptics.NotificationFeedbackType.Success
                : Haptics.NotificationFeedbackType.Warning,
        ).catch(() => undefined);
    }, [graded, result?.correct]);

    const back = onBack ? <BackButton onPress={onBack} /> : null;

    if (!graded) {
        if (hideSubmit && !back && !revisiting) return null;
        // Back to an answered exercise, three buttons share the row: Back and
        // Next are arrows then, so Check keeps its room in a language with long
        // words (Burmese, Filipino, Indonesian).
        return (
            <View style={[styles.container, styles.row]}>
                {onBack ? <BackButton onPress={onBack} compact={revisiting} /> : null}
                {hideSubmit ? (
                    <View style={styles.grow} />
                ) : (
                    <Button
                        title={t("check")}
                        size="lg"
                        disabled={!canSubmit}
                        onPress={() => onSubmit()}
                        accessibilityHint={canSubmit ? undefined : t("checkHint")}
                        style={styles.main}
                    />
                )}
                {revisiting ? (
                    <Button
                        title={t("next")}
                        size="lg"
                        variant="outline"
                        icon={<Ionicons name="arrow-forward" size={20} color={colors.link} />}
                        compact
                        steady="next"
                        style={styles.side}
                        onPress={() => onNext()}
                    />
                ) : null}
            </View>
        );
    }

    const tone = result.correct ? "correct" : "incorrect";

    return (
        <View style={[styles.container, styles[tone]]}>
            <View style={styles.headline}>
                <Ionicons
                    name={result.correct ? "checkmark-circle" : "close-circle"}
                    size={28}
                    color={result.correct ? colors.success : colors.destructive}
                />
                <Text
                    variant="subheading"
                    color={result.correct ? colors.success : colors.destructive}
                    style={styles.headlineText}
                >
                    {result.correct
                        ? result.accepted
                            ? t("acceptedTitle")
                            : t("correctTitle")
                        : t("incorrectTitle")}
                </Text>
            </View>

            {/* The model answer is shown after a miss, and when the learner was
          right but phrased it differently. What was spoken in a listening
          exercise is shown every time: a learner who understood the sound has
          still never seen the word, and this is where the two are joined. */}
            {!result.modelAnswer ||
            (result.correct && !result.accepted && result.modelAnswerKind !== "audio") ? null : (
                <Text variant="caption">
                    {/* After a miss it is the right answer, not another way to say theirs. */}
                    {t(
                        result.modelAnswerKind === "audio"
                            ? "audioWas"
                            : result.correct
                              ? "modelAnswer"
                              : "rightAnswer",
                    )}
                    {"  "}
                    <Text variant="bodyStrong">{result.modelAnswer}</Text>
                </Text>
            )}

            {result.missing?.length ? (
                <Text variant="caption">
                    {t("missingWords", { words: result.missing.join(", ") })}
                </Text>
            ) : null}

            <View style={styles.row}>
                {back}
                <Button
                    title={isLastStep ? t("finish") : result.correct ? t("continue") : t("gotIt")}
                    size="lg"
                    variant={result.correct ? "primary" : "destructive"}
                    onPress={() => onNext()}
                    style={styles.main}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: colors.surface,
    },
    correct: { backgroundColor: colors.successSoft, borderTopColor: colors.success },
    incorrect: { backgroundColor: colors.destructiveSoft, borderTopColor: colors.destructive },
    headline: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    headlineText: { flexShrink: 1 },
    row: { flexDirection: "row", gap: spacing.md },
    grow: { flex: 1, minWidth: 0 },
    // Sharing a row, the buttons pad less than a lone one. The answer's own
    // button never narrows past this; Back and Next give way instead, wrapping
    // their label, so three buttons in a long script still fit a small phone.
    main: { flex: 1, minWidth: 96, paddingHorizontal: spacing.md },
    side: { flexShrink: 1, paddingHorizontal: spacing.md },
});
