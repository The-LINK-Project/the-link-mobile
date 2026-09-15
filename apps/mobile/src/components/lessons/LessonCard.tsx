import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Badge, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import type { LessonIcon } from "@/lib/lessons/icons";
import { useLocalized } from "@/lib/lessons/localized";
import type { Lesson } from "@/lib/lessons/types";
import { colors, radius, shadow, spacing } from "@/lib/theme";

/** One picture per lesson, so a learner can find the lesson without reading. */
const ICONS: Record<LessonIcon, React.ComponentProps<typeof Ionicons>["name"]> = {
    train: "train-outline",
    clinic: "medkit-outline",
    food: "restaurant-outline",
    work: "construct-outline",
    mix: "shuffle-outline",
};

/**
 * Entry point for a lesson on the Home tab.
 *
 * Leads with what the learner will be able to do rather than the lesson title,
 * because "ask for the right platform" is a reason to tap and "Taking the MRT"
 * is only a label.
 */
export function LessonCard({ lesson }: { lesson: Lesson }) {
    const t = useTranslations("mobile.lessons");
    const localized = useLocalized();
    const router = useRouter();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={localized(lesson.title)}
            accessibilityHint={localized(lesson.goal)}
            onPress={() => router.push(`/lesson/${lesson.id}`)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
            <View style={styles.icon}>
                <Ionicons name={ICONS[lesson.icon]} size={26} color={colors.primaryDark} />
            </View>

            <View style={styles.body}>
                <Text variant="subheading">{localized(lesson.title)}</Text>
                <Text variant="caption">{localized(lesson.goal)}</Text>
                <View style={styles.meta}>
                    <Badge
                        label={t("minutes", { count: lesson.estimatedMinutes })}
                        tone="primary"
                    />
                    <Badge label={t(`level.${lesson.level}`)} />
                </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
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
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        ...shadow.card,
    },
    pressed: { opacity: 0.85 },
    icon: {
        width: 52,
        height: 52,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
    },
    body: { flex: 1, gap: spacing.xs },
    meta: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
