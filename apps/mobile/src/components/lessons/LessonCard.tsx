import { useFirstLanguageLocalized } from "@/lib/lessons/localized";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { Lesson } from "@/lib/lessons/types";
import { lessonStage, type LessonStatus } from "@/lib/progress/model";
import { canPractiseSpeaking } from "@/lib/speaking/context";
import { colors, radius, spacing, TOUCH_TARGET } from "@/lib/theme";

import { Medallion, STAGE_COLORS } from "./Medallion";

export { LESSON_ICONS } from "./Medallion";

type Props = {
    lesson: Lesson;
    status: LessonStatus;
    /** The lesson to take next. Marked, never enforced: nothing is locked. */
    next?: boolean;
    /** Shown instead of the usual status, e.g. the daily mix done for today. */
    doneLabel?: string;
    /** Present when the exercises are finished and the lesson can be said aloud. */
    onSpeak?: () => void;
};

/** How far a pressed card or button sinks: its lower edge is this much heavier. */
const LIP = 3;

/**
 * Entry point for a lesson on the Home tab.
 *
 * Drawn like a key that can be pressed: a thick outline with a heavier lower
 * edge that sinks under the finger. Where the lesson stands is said three ways
 * at once, for a learner who cannot tell the colours apart or reads little:
 * the outline's colour (grey, blue for the one to start with, yellow under
 * way, green done), the ring round the lesson's picture filling up, and the
 * words above the title. Each lesson keeps its own colour on its coin, so it
 * can be found again by colour and picture without reading.
 *
 * No lesson is ever locked. Somebody who is going to the clinic tomorrow needs
 * the clinic lesson today, whatever order the list is in.
 */
export function LessonCard({ lesson, status, next = false, doneLabel, onSpeak }: Props) {
    const t = useFirstLanguageInterface("lessons");
    const localized = useFirstLanguageLocalized();
    const router = useRouter();
    const [pressed, setPressed] = useState(false);
    const { run, talk } = status;
    // Said by `doneLabel` for the daily mix, which is new again every morning.
    const stage = doneLabel ? "done" : lessonStage(status);
    const tone = STAGE_COLORS[next && stage === "new" ? "next" : stage];

    const stageLabel =
        doneLabel ??
        (stage === "done"
            ? t("statusDone")
            : stage === "progress"
              ? t("statusInProgress")
              : next
                ? t("statusNext")
                : t("statusNotStarted"));
    const detail = run
        ? t("statusStarted", run)
        : status.finished !== "learned"
          ? ""
          : talk
            ? t("continueTalk", talk)
            : t("statusSpeakingLeft");

    const fraction = progressShare(status, canPractiseSpeaking(lesson));
    // Owed, not optional, until the talk is done: it is the way to finish.
    const speakOwed = stage !== "done";

    return (
        <View
            style={[
                styles.card,
                { borderColor: tone.ring, borderBottomColor: tone.lip },
                pressed && styles.cardPressed,
            ]}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={[localized(lesson.title), stageLabel, detail]
                    .filter(Boolean)
                    .join(". ")}
                accessibilityHint={localized(lesson.goal)}
                onPress={() => router.push(`/lesson/${lesson.id}`)}
                onPressIn={() => setPressed(true)}
                onPressOut={() => setPressed(false)}
                style={styles.main}
            >
                <Medallion icon={lesson.icon} fraction={fraction} done={stage === "done"} />

                <View style={styles.body}>
                    <Text variant="label" color={tone.text} style={styles.status}>
                        {stageLabel}
                        {detail ? (
                            <Text variant="label" color={tone.text} style={styles.detail}>
                                {` · ${detail}`}
                            </Text>
                        ) : null}
                    </Text>
                    <Text variant="subheading" style={styles.title}>
                        {localized(lesson.title)}
                    </Text>
                    <Text variant="caption" style={styles.description}>
                        {localized(lesson.goal)}
                    </Text>
                    {stage === "new" ? (
                        <View style={styles.metaRow}>
                            <Text variant="caption" style={styles.meta}>
                                {t("minutes", { count: lesson.estimatedMinutes })}
                            </Text>
                            <Text variant="caption" style={styles.meta}>
                                ·
                            </Text>
                            <Text variant="caption" style={styles.meta}>
                                {t(`level.${lesson.level}`)}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </Pressable>

            {onSpeak ? (
                <View style={styles.speakRow}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${t("summarySpeak")}. ${localized(lesson.title)}`}
                        onPress={onSpeak}
                        style={({ pressed: down }) => [
                            styles.speak,
                            speakOwed ? styles.speakOwed : styles.speakAgain,
                            down &&
                                (speakOwed ? styles.speakOwedPressed : styles.speakAgainPressed),
                        ]}
                    >
                        <Ionicons
                            name="mic"
                            size={20}
                            color={speakOwed ? SPEAK_OWED_TEXT : STAGE_COLORS.next.text}
                        />
                        <Text
                            variant="label"
                            color={speakOwed ? SPEAK_OWED_TEXT : STAGE_COLORS.next.text}
                            style={styles.speakText}
                        >
                            {t("summarySpeak")}
                        </Text>
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
}

/**
 * How much of the lesson is behind the learner, for the ring. A lesson with a
 * talk is two halves: the exercises, then the talk. A lesson under way always
 * shows a sliver, so it never looks the same as one not started.
 */
function progressShare({ finished, run, talk }: LessonStatus, twoStages: boolean): number {
    if (finished === "done") return 1;
    const half = twoStages ? 0.5 : 1;
    let share = 0;
    if (finished === "learned") share = half + (talk ? (1 - half) * (talk.done / talk.total) : 0);
    else if (run) share = half * (run.done / run.total);
    else if (talk) share = (1 - half) * (talk.done / talk.total);
    const started = finished !== "none" || run || talk;
    return started ? Math.max(share, 0.05) : 0;
}

/** Dark enough to read on the bright yellow button. */
const SPEAK_OWED_TEXT = "#4d3500";

const styles = StyleSheet.create({
    card: {
        borderRadius: radius.lg,
        borderWidth: 2,
        borderBottomWidth: 2 + LIP,
        backgroundColor: colors.surface,
    },
    // The lower edge gives way and the card moves down by as much, so nothing
    // around it shifts.
    cardPressed: { borderBottomWidth: 2, marginTop: LIP },
    main: { flexDirection: "row", alignItems: "center", gap: spacing.lg, padding: spacing.lg },
    body: { flex: 1, gap: 2 },
    status: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
    detail: { fontSize: 13, fontWeight: "700", letterSpacing: 0, textTransform: "none" },
    title: { fontWeight: "800", color: "#3c3c3c" },
    description: { flexShrink: 1, color: "#6b6b6b" },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: spacing.xs },
    meta: { fontSize: 13, fontWeight: "700", color: "#737373" },
    speakRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    speak: {
        minHeight: TOUCH_TARGET,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        borderBottomWidth: LIP + 1,
    },
    speakOwed: { backgroundColor: "#ffc800", borderBottomColor: "#e5a800" },
    // Once done, another go is an offer, not a second loud button.
    speakAgain: {
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: STAGE_COLORS.new.ring,
        borderBottomWidth: 2 + LIP,
    },
    // As with the card, the lower edge gives way by as much as the button moves.
    speakOwedPressed: { borderBottomWidth: 0, marginTop: LIP + 1 },
    speakAgainPressed: { borderBottomWidth: 2, marginTop: LIP },
    speakText: { fontSize: 15, fontWeight: "800", letterSpacing: 0.5, flexShrink: 1 },
});
