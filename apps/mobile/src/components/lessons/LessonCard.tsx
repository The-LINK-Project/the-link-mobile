import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Badge, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import type { LessonIcon } from "@/lib/lessons/icons";
import { useLocalized } from "@/lib/lessons/localized";
import type { Lesson } from "@/lib/lessons/types";
import type { LessonStatus } from "@/lib/progress/model";
import { colors, radius, shadow, spacing, TOUCH_TARGET } from "@/lib/theme";

/** One picture per lesson, so a learner can find the lesson without reading. */
export const LESSON_ICONS: Record<LessonIcon, React.ComponentProps<typeof Ionicons>["name"]> = {
    train: "train-outline",
    clinic: "medkit-outline",
    food: "restaurant-outline",
    work: "construct-outline",
    mix: "shuffle-outline",
};

type Props = {
    lesson: Lesson;
    status: LessonStatus;
    /** The lesson to take next. Marked, never enforced: nothing is locked. */
    next?: boolean;
    /** Shown instead of the usual badges, e.g. the daily mix done for today. */
    doneLabel?: string;
    /** Present when the lesson is finished and can be practised aloud. */
    onSpeak?: () => void;
};

/**
 * Entry point for a lesson on the Home tab.
 *
 * Leads with what the learner will be able to do rather than the lesson title,
 * because "ask for the right platform" is a reason to tap and "Taking the MRT"
 * is only a label.
 *
 * Where the lesson stands is carried by a picture as well as words: a tick, a
 * bar, a microphone. A learner who reads little can still see what is done.
 * No lesson is ever locked. Somebody who is going to the clinic tomorrow needs
 * the clinic lesson today, whatever order the list is in.
 */
export function LessonCard({ lesson, status, next = false, doneLabel, onSpeak }: Props) {
    const t = useTranslations("mobile.lessons");
    const localized = useLocalized();
    const router = useRouter();
    const finished = status.kind === "learned" || status.kind === "spoken";

    const statusLabel =
        status.kind === "started"
            ? t("statusStarted", { done: status.done, total: status.total })
            : status.kind === "spoken"
              ? t("statusSpoken")
              : status.kind === "learned"
                ? t("statusLearned")
                : next
                  ? t("statusNext")
                  : "";

    return (
        <View style={[styles.card, next && styles.cardNext]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={[localized(lesson.title), statusLabel]
                    .filter(Boolean)
                    .join(". ")}
                accessibilityHint={localized(lesson.goal)}
                onPress={() => router.push(`/lesson/${lesson.id}`)}
                style={({ pressed }) => [styles.main, pressed && styles.pressed]}
            >
                <View style={[styles.icon, finished && styles.iconDone]}>
                    <Ionicons
                        name={LESSON_ICONS[lesson.icon]}
                        size={26}
                        color={finished ? colors.white : colors.primaryDark}
                    />
                    {finished ? (
                        <View style={styles.tick}>
                            <Ionicons name="checkmark" size={14} color={colors.white} />
                        </View>
                    ) : null}
                </View>

                <View style={styles.body}>
                    <Text variant="subheading">{localized(lesson.title)}</Text>
                    <Text variant="caption">{localized(lesson.goal)}</Text>

                    {status.kind === "started" ? (
                        <View style={styles.started}>
                            <View style={styles.track}>
                                <View
                                    style={[
                                        styles.fill,
                                        { width: `${(status.done / status.total) * 100}%` },
                                    ]}
                                />
                            </View>
                            <Text
                                variant="caption"
                                color={colors.primaryDark}
                                style={styles.strong}
                            >
                                {statusLabel}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.meta}>
                            {doneLabel ? (
                                <Badge label={doneLabel} tone="success" />
                            ) : finished ? (
                                <Badge label={statusLabel} tone="success" />
                            ) : (
                                <>
                                    {next ? <Badge label={statusLabel} tone="accent" /> : null}
                                    <Badge
                                        label={t("minutes", { count: lesson.estimatedMinutes })}
                                        tone="primary"
                                    />
                                    {next ? null : <Badge label={t(`level.${lesson.level}`)} />}
                                </>
                            )}
                        </View>
                    )}
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>

            {onSpeak ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t("summarySpeak")}. ${localized(lesson.title)}`}
                    onPress={onSpeak}
                    style={({ pressed }) => [styles.speak, pressed && styles.pressed]}
                >
                    <Ionicons
                        name={status.kind === "spoken" ? "mic" : "mic-outline"}
                        size={20}
                        color={colors.primaryDark}
                    />
                    <Text variant="bodyStrong" color={colors.primaryDark} style={styles.speakText}>
                        {t("summarySpeak")}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: "hidden",
        ...shadow.card,
    },
    cardNext: { borderColor: colors.primary, borderWidth: 2 },
    main: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
    pressed: { opacity: 0.85 },
    icon: {
        width: 52,
        height: 52,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
    },
    iconDone: { backgroundColor: colors.primaryDark },
    tick: {
        position: "absolute",
        right: -6,
        bottom: -6,
        width: 22,
        height: 22,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.success,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    body: { flex: 1, gap: spacing.xs },
    meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    started: { gap: spacing.xs, marginTop: spacing.xs },
    track: {
        height: 8,
        borderRadius: radius.full,
        backgroundColor: colors.mutedSurface,
        overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.primary },
    strong: { fontWeight: "600" },
    speak: {
        minHeight: TOUCH_TARGET,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: colors.primarySoft,
    },
    speakText: { flexShrink: 1 },
});
