import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { LessonHeading } from "@/components/lessons/LessonHeading";
import { LessonStages } from "@/components/lessons/LessonStages";
import { WithBack } from "@/components/lessons/StepNav";
import { Button, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { Lesson } from "@/lib/lessons/types";
import type { GoalResult } from "@/lib/speaking/conversation";
import { colors, radius, spacing } from "@/lib/theme";

type Props = {
    lesson: Lesson;
    goals: { id: string; target: string; result: GoalResult }[];
    onDone: () => void;
    onAgain: () => void;
    /** Back to the talk these results came from. */
    onBack?: () => void;
};

/**
 * What the learner said aloud. A goal the tutor had to say for them is shown as
 * practised, not failed: they still heard it and tried it, and a red mark is not
 * what someone needs after speaking a new language out loud for the first time.
 *
 * This is where a lesson ends. The talk is its second stage, so finishing it is
 * what finishes the lesson, and this is the screen that says "Lesson done!".
 */
export function SpeakingSummary({ lesson, goals, onDone, onAgain, onBack }: Props) {
    const t = useFirstLanguageInterface("speaking");
    const l = useFirstLanguageInterface("lessons");

    return (
        <View style={styles.container}>
            <LessonHeading lesson={lesson} title={l("summaryTitle")} fraction={1} done>
                <LessonStages learn="done" speak="done" size="lg" />
                <Text variant="caption">
                    {t("summaryCount", {
                        said: goals.filter((goal) => goal.result === "said").length,
                        total: goals.length,
                    })}
                </Text>
            </LessonHeading>

            <View style={styles.goals}>
                {goals.map((goal) => {
                    const said = goal.result === "said";
                    return (
                        <View key={goal.id} style={[styles.goal, said && styles.goalSaid]}>
                            {/* Said: a green coin with a tick. Said for them: the
                                tutor's voice, heard and tried, never a cross. */}
                            <View style={[styles.coin, said ? styles.coinSaid : styles.coinHelped]}>
                                <Ionicons
                                    name={said ? "checkmark" : "volume-high"}
                                    size={said ? 22 : 20}
                                    color={said ? colors.white : colors.muted}
                                />
                            </View>
                            <View style={styles.goalText}>
                                <Text variant="bodyStrong">{goal.target}</Text>
                                <Text variant="caption">
                                    {said ? t("summarySaid") : t("summaryHelped")}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>

            <WithBack onBack={onBack}>
                <View style={styles.actions}>
                    <Button title={t("done")} size="lg" onPress={onDone} />
                    <Button title={t("again")} variant="outline" onPress={onAgain} />
                </View>
            </WithBack>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl, paddingBottom: spacing.xl },
    goals: { gap: spacing.md },
    goal: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderBottomWidth: 6,
        borderColor: colors.key,
        backgroundColor: colors.surface,
    },
    goalSaid: { borderColor: "#58cc02", borderBottomColor: "#46a302" },
    coin: {
        width: 40,
        height: 40,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: 3,
    },
    coinSaid: { backgroundColor: "#58cc02", borderBottomColor: "#46a302" },
    coinHelped: { backgroundColor: colors.mutedSurface, borderBottomColor: colors.keyLip },
    goalText: { flex: 1, gap: spacing.xs },
    actions: { gap: spacing.md },
});
