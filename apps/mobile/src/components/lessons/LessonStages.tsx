import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { LessonStatus } from "@/lib/progress/model";
import { colors, radius, spacing } from "@/lib/theme";

type StageState = "todo" | "current" | "done";

/** Which of a lesson's two stages are behind the learner, and which is next. */
export function stagesOf(status: LessonStatus): { learn: StageState; speak: StageState } {
    if (status.finished === "done") return { learn: "done", speak: "done" };
    if (status.finished === "learned") return { learn: "done", speak: "current" };
    // A talk opened from a link, with no exercises on record, is still a start.
    return { learn: status.run ? "current" : "todo", speak: status.talk ? "current" : "todo" };
}

const PALETTE: Record<StageState, { bg: string; fg: string; border: string }> = {
    todo: { bg: colors.surface, fg: colors.muted, border: colors.border },
    current: { bg: colors.warningSoft, fg: colors.warning, border: colors.warningFill },
    done: { bg: colors.success, fg: colors.white, border: colors.success },
};

/**
 * The two stages of a lesson, side by side: the exercises, then the talk.
 *
 * Speaking used to be offered after the lesson as something extra, and a
 * learner could collect a tick without ever opening their mouth. Showing both
 * stages wherever the lesson is shown is what says the talk is part of it.
 */
export function LessonStages({
    learn,
    speak,
    size = "sm",
}: {
    learn: StageState;
    speak: StageState;
    size?: "sm" | "lg";
}) {
    const t = useFirstLanguageInterface("lessons");
    return (
        // Read out by whatever holds it, which already says where the lesson stands.
        <View
            style={styles.row}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            <Stage state={learn} icon="book" label={t("stageLearn")} size={size} />
            <View style={[styles.link, learn === "done" && styles.linkDone]} />
            <Stage state={speak} icon="mic" label={t("stageSpeak")} size={size} />
        </View>
    );
}

function Stage({
    state,
    icon,
    label,
    size,
}: {
    state: StageState;
    icon: "book" | "mic";
    label: string;
    size: "sm" | "lg";
}) {
    const palette = PALETTE[state];
    const side = size === "lg" ? 36 : 24;
    return (
        <View style={styles.stage}>
            <View
                style={[
                    styles.dot,
                    {
                        width: side,
                        height: side,
                        backgroundColor: palette.bg,
                        borderColor: palette.border,
                    },
                ]}
            >
                <Ionicons
                    name={state === "done" ? "checkmark" : icon}
                    size={side * 0.55}
                    color={palette.fg}
                />
            </View>
            <Text
                variant={size === "lg" ? "bodyStrong" : "caption"}
                color={state === "todo" ? colors.muted : colors.foreground}
                style={styles.label}
            >
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    // One line, always: wrapped, the second stage sat under the first with
    // the link between them pointing at nothing. Long labels wrap inside.
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stage: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 },
    dot: {
        borderRadius: radius.full,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
    },
    label: { flexShrink: 1 },
    link: { width: 16, height: 2, borderRadius: 1, backgroundColor: colors.border },
    linkDone: { backgroundColor: colors.success },
});
