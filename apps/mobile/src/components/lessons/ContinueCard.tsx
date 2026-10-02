import { useFirstLanguageLocalized } from "@/lib/lessons/localized";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { Lesson } from "@/lib/lessons/types";
import type { ContinuePoint } from "@/lib/progress/model";
import { canPractiseSpeaking } from "@/lib/speaking/context";
import { colors, radius, spacing } from "@/lib/theme";

import { Medallion } from "./Medallion";

/** How far the card sinks when pressed: its lower edge is this much heavier. */
const LIP = 3;

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
    const localized = useFirstLanguageLocalized();
    const where =
        point.kind === "speak"
            ? t("statusSpeakingLeft")
            : point.kind === "talk"
              ? t("continueTalk", { done: point.done, total: point.total })
              : t("statusStarted", { done: point.done, total: point.total });
    // How far through the stage in hand, for the bar.
    const share = point.kind === "speak" ? 0.5 : point.done / point.total;
    // How far through the whole lesson, for the ring, the same as on its card:
    // with the exercises behind them and the talk ahead, the lesson is half done.
    const half = canPractiseSpeaking(lesson) ? 0.5 : 1;
    const whole =
        point.kind === "speak"
            ? half
            : point.kind === "talk"
              ? half + (1 - half) * share
              : half * share;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("continueTitle")}. ${localized(lesson.title)}. ${where}`}
            onPress={onPress}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
            <View style={styles.icon}>
                <Medallion
                    icon={lesson.icon}
                    fraction={Math.max(whole, 0.05)}
                    done={false}
                    size="sm"
                >
                    {point.kind === "lesson" ? undefined : (
                        <Ionicons name="mic" size={24} color={colors.white} />
                    )}
                </Medallion>
            </View>
            <View style={styles.body}>
                <Text variant="label" color={colors.onPrimary}>
                    {t("continueTitle")}
                </Text>
                <Text variant="subheading" color={colors.onPrimary}>
                    {localized(lesson.title)}
                </Text>
                <View style={styles.track}>
                    <View style={[styles.fill, { width: `${share * 100}%` }]} />
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
    // A key, like the lesson cards below it, in the app's own green.
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderBottomWidth: 2 + LIP,
        borderColor: colors.primaryDark,
        backgroundColor: colors.primary,
    },
    // The lower edge gives way and the card moves down by as much.
    pressed: { borderBottomWidth: 2, marginTop: LIP },
    icon: { borderRadius: radius.full, backgroundColor: colors.surface },
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
        borderBottomWidth: 4,
        borderBottomColor: colors.onPrimary,
    },
});
