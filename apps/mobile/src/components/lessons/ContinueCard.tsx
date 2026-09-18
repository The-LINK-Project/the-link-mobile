import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { useHomeLessonCopy } from "@/lib/firstLanguage/homeLessonCopy";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { Lesson } from "@/lib/lessons/types";
import type { ContinuePoint } from "@/lib/progress/model";
import { colors, radius, shadow, spacing } from "@/lib/theme";

import { LESSON_ICONS } from "./LessonCard";

/**
 * The one thing at the top of Home when something was left unfinished.
 *
 * A learner who was interrupted, by a supervisor, a phone call, the end of a
 * break, should not have to find their lesson in a list and wonder whether it
 * will start again. This says what it was, how far they got, and goes there.
 */
export function ContinueCard({
    lesson,
    point,
    onPress,
}: {
    lesson: Lesson;
    point: ContinuePoint;
    onPress: () => void;
}) {
    const t = useFirstLanguageInterface("lessons");
    const lessonCopy = useHomeLessonCopy();
    const where =
        point.kind === "talk"
            ? t("continueTalk", { done: point.done, total: point.total })
            : t("statusStarted", { done: point.done, total: point.total });

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("continueTitle")}. ${lessonCopy(lesson.title)}. ${where}`}
            onPress={onPress}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
            <View style={styles.icon}>
                <Ionicons
                    name={point.kind === "talk" ? "mic" : LESSON_ICONS[lesson.icon]}
                    size={26}
                    color={colors.onPrimary}
                />
            </View>
            <View style={styles.body}>
                <Text variant="label" color={colors.onPrimary}>
                    {t("continueTitle")}
                </Text>
                <Text variant="subheading" color={colors.onPrimary}>
                    {lessonCopy(lesson.title)}
                </Text>
                <View style={styles.track}>
                    <View
                        style={[styles.fill, { width: `${(point.done / point.total) * 100}%` }]}
                    />
                </View>
                <Text variant="caption" color={colors.onPrimary}>
                    {where}
                </Text>
            </View>
            <View style={styles.go}>
                <Ionicons name="play" size={22} color={colors.white} />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.primary,
        ...shadow.raised,
    },
    pressed: { opacity: 0.9 },
    icon: {
        width: 52,
        height: 52,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
    },
    body: { flex: 1, gap: spacing.xs },
    track: {
        height: 8,
        borderRadius: radius.full,
        backgroundColor: colors.primarySoft,
        overflow: "hidden",
        marginTop: spacing.xs,
    },
    fill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.primaryDark },
    go: {
        width: 48,
        height: 48,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primaryDark,
    },
});
