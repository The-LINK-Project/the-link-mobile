import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { LessonStages } from "@/components/lessons/LessonStages";
import { Button, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { GoalResult } from "@/lib/speaking/conversation";
import { colors, spacing } from "@/lib/theme";

type Props = {
    title: string;
    goals: { id: string; target: string; result: GoalResult }[];
    onDone: () => void;
    onAgain: () => void;
};

/**
 * What the learner said aloud. A goal the tutor had to say for them is shown as
 * practised, not failed: they still heard it and tried it, and a red mark is not
 * what someone needs after speaking a new language out loud for the first time.
 *
 * This is where a lesson ends. The talk is its second stage, so finishing it is
 * what finishes the lesson, and this is the screen that says "Lesson done!".
 */
export function SpeakingSummary({ title, goals, onDone, onAgain }: Props) {
    const t = useFirstLanguageInterface("speaking");
    const l = useFirstLanguageInterface("lessons");

    return (
        <View style={styles.container}>
            <View style={styles.hero}>
                <Text variant="label">{title}</Text>
                <Text variant="title">{l("summaryTitle")}</Text>
                <LessonStages learn="done" speak="done" size="lg" />
                <Text variant="caption">
                    {t("summaryCount", {
                        said: goals.filter((goal) => goal.result === "said").length,
                        total: goals.length,
                    })}
                </Text>
            </View>

            <View>
                {goals.map((goal) => {
                    const said = goal.result === "said";
                    return (
                        <View key={goal.id} style={styles.goal}>
                            <Ionicons
                                name={said ? "checkmark-circle" : "ellipse-outline"}
                                size={24}
                                color={said ? colors.success : colors.muted}
                            />
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

            <View style={styles.actions}>
                <Button title={t("done")} size="lg" onPress={onDone} />
                <Button title={t("again")} variant="outline" onPress={onAgain} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl, paddingBottom: spacing.xl },
    hero: { gap: spacing.sm, paddingTop: spacing.sm },
    goal: {
        flexDirection: "row",
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
    },
    goalText: { flex: 1, gap: spacing.xs },
    actions: { gap: spacing.md },
});
