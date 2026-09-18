import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { GradeResult } from "@/lib/lessons/types";
import { colors, spacing } from "@/lib/theme";

/**
 * The footer that grades the lesson: Check while answering, then the outcome
 * banner and Continue.
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
};

export function LessonFooter({
    phase,
    canSubmit,
    result,
    onSubmit,
    onNext,
    isLastStep,
    hideSubmit,
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

    if (!graded) {
        if (hideSubmit) return null;
        return (
            <View style={styles.container}>
                <Button
                    title={t("check")}
                    size="lg"
                    disabled={!canSubmit}
                    onPress={() => onSubmit()}
                    accessibilityHint={canSubmit ? undefined : t("checkHint")}
                />
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
                    {t(result.modelAnswerKind === "audio" ? "audioWas" : "modelAnswer")}
                    {"  "}
                    <Text variant="bodyStrong">{result.modelAnswer}</Text>
                </Text>
            )}

            {result.missing?.length ? (
                <Text variant="caption">
                    {t("missingWords", { words: result.missing.join(", ") })}
                </Text>
            ) : null}

            <Button
                title={isLastStep ? t("finish") : result.correct ? t("continue") : t("gotIt")}
                size="lg"
                variant={result.correct ? "primary" : "destructive"}
                onPress={() => onNext()}
            />
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
});
