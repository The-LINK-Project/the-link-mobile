import { useFirstLanguageLocalized } from "@/lib/lessons/localized";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { Badge, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import type { LessonIcon } from "@/lib/lessons/icons";
import type { Lesson } from "@/lib/lessons/types";
import { lessonStage, type LessonStage, type LessonStatus } from "@/lib/progress/model";
import { canPractiseSpeaking } from "@/lib/speaking/context";
import { colors, radius, shadow, spacing, TOUCH_TARGET } from "@/lib/theme";

import { LessonStages, stagesOf } from "./LessonStages";

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
    /** Present when the exercises are finished and the lesson can be said aloud. */
    onSpeak?: () => void;
};

/**
 * Entry point for a lesson on the Home tab.
 *
 * Leads with what the learner will be able to do rather than the lesson title,
 * because "ask for the right platform" is a reason to tap and "Taking the MRT"
 * is only a label.
 *
 * Where the lesson stands is one of three things, and each looks like nothing
 * else: not started is an empty outline, in progress is yellow, done is a
 * white card with a green tick. Both of the last two have a faint lattice of
 * diamonds behind them in their colour, the way a certificate has a pattern
 * in its paper, so a card that has been touched looks different from one
 * that has not even before the colour is read. The app's own colour is green,
 * and a finished lesson used to be a paler shade of the buttons around it,
 * which nobody could tell apart at a glance. Every colour is said again by a
 * picture and by words, for a learner who cannot tell the colours apart or
 * reads little.
 *
 * No lesson is ever locked. Somebody who is going to the clinic tomorrow needs
 * the clinic lesson today, whatever order the list is in.
 */
export function LessonCard({ lesson, status, next = false, doneLabel, onSpeak }: Props) {
    const t = useFirstLanguageInterface("lessons");
    const localized = useFirstLanguageLocalized();
    const router = useRouter();
    const { run, talk } = status;
    // Said by `doneLabel` for the daily mix, which is new again every morning.
    const stage = doneLabel ? "done" : lessonStage(status);
    const twoStages = canPractiseSpeaking(lesson);

    const stageLabel =
        doneLabel ??
        (stage === "done"
            ? t("statusDone")
            : stage === "progress"
              ? t("statusInProgress")
              : next
                ? t("statusNext")
                : t("statusNotStarted"));
    // How far the stage in hand has got. A lesson being gone through again is
    // still a finished lesson: the tick stays, and the bar is the new run's.
    const bar = run ?? (status.finished === "learned" ? talk : null);
    const detail = run
        ? t("statusStarted", run)
        : status.finished !== "learned"
          ? ""
          : talk
            ? t("continueTalk", talk)
            : t("statusSpeakingLeft");

    const tile = TILE[stage];

    return (
        <View
            style={[
                styles.card,
                stage === "progress" && styles.cardProgress,
                stage === "done" && styles.cardDone,
                next && stage === "new" && styles.cardNext,
            ]}
        >
            {stage === "done" ? <Lattice color={colors.success} /> : null}
            {stage === "progress" ? <Lattice color={colors.warningFill} /> : null}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={[localized(lesson.title), stageLabel, detail]
                    .filter(Boolean)
                    .join(". ")}
                accessibilityHint={localized(lesson.goal)}
                onPress={() => router.push(`/lesson/${lesson.id}`)}
                style={({ pressed }) => [styles.main, pressed && styles.pressed]}
            >
                <View style={[styles.icon, { backgroundColor: tile.bg, borderColor: tile.border }]}>
                    <Ionicons name={LESSON_ICONS[lesson.icon]} size={26} color={tile.fg} />
                    {stage === "new" ? null : (
                        <View
                            style={[
                                styles.mark,
                                stage === "done" ? styles.markDone : styles.markProgress,
                            ]}
                        >
                            <Ionicons
                                name={stage === "done" ? "checkmark" : "ellipsis-horizontal"}
                                size={14}
                                color={colors.white}
                            />
                        </View>
                    )}
                </View>

                <View style={styles.body}>
                    <Text variant="subheading">{localized(lesson.title)}</Text>
                    <Text variant="caption" style={styles.description}>
                        {localized(lesson.goal)}
                    </Text>

                    <View style={styles.meta}>
                        <Badge
                            label={stageLabel}
                            tone={STAGE_TONE[next && stage === "new" ? "next" : stage]}
                            icon={stage === "new" && next ? undefined : STAGE_ICON[stage]}
                        />
                        {stage === "new" ? (
                            <>
                                <Badge
                                    label={t("minutes", { count: lesson.estimatedMinutes })}
                                    tone="primary"
                                />
                                {next ? null : <Badge label={t(`level.${lesson.level}`)} />}
                            </>
                        ) : null}
                    </View>

                    {bar ? (
                        <View style={styles.track}>
                            <View
                                style={[
                                    styles.fill,
                                    stage === "done" && styles.fillDone,
                                    { width: `${(bar.done / bar.total) * 100}%` },
                                ]}
                            />
                        </View>
                    ) : null}
                    {detail ? (
                        <Text
                            variant="caption"
                            color={stage === "done" ? colors.success : colors.warning}
                            style={styles.strong}
                        >
                            {detail}
                        </Text>
                    ) : null}
                </View>

                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>

            {/* Under the row and as wide as the card: beside the picture there is
                no room for two labels in Bengali or Tamil. A done lesson has
                said all this with its tick. */}
            {twoStages && stage !== "done" ? (
                <View style={styles.stages}>
                    <LessonStages {...stagesOf(status)} />
                </View>
            ) : null}

            {onSpeak ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t("summarySpeak")}. ${localized(lesson.title)}`}
                    onPress={onSpeak}
                    style={({ pressed }) => [
                        styles.speak,
                        // Owed, not optional: it is the way to finish the lesson.
                        stage === "progress" && styles.speakOwed,
                        // Once done, another go is an offer, not a second green band.
                        stage === "done" && styles.speakAgain,
                        pressed && styles.pressed,
                    ]}
                >
                    <Ionicons
                        name={stage === "done" ? "mic-outline" : "mic"}
                        size={20}
                        color={stage === "progress" ? colors.warning : colors.primaryDark}
                    />
                    <Text
                        variant="bodyStrong"
                        color={stage === "progress" ? colors.warning : colors.primaryDark}
                        style={styles.speakText}
                    >
                        {t("summarySpeak")}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}

/** Distance between diamonds in the lattice, and the width of one. */
const LATTICE_STEP = 26;
const DIAMOND = 5;

/**
 * The pattern behind a lesson that has been started or finished: small
 * diamonds in staggered rows, so faint they read as texture rather than as
 * something to look at, in the colour of the stage. Drawn with views because
 * the app has no vector library, and sized to the card so it is the same on
 * any phone. It is decoration, hidden from screen readers.
 */
function Lattice({ color }: { color: string }) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const cols = Math.ceil(size.width / LATTICE_STEP) + 1;
    const rows = Math.ceil(size.height / LATTICE_STEP) + 1;
    const onLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) setSize({ width, height });
    };
    return (
        <View
            pointerEvents="none"
            onLayout={onLayout}
            style={styles.lattice}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            {Array.from({ length: rows }, (_, row) => (
                <View
                    key={row}
                    style={[styles.latticeRow, row % 2 === 1 && styles.latticeRowShifted]}
                >
                    {Array.from({ length: cols }, (_, col) => (
                        <View key={col} style={[styles.diamond, { backgroundColor: color }]} />
                    ))}
                </View>
            ))}
        </View>
    );
}

const TILE: Record<LessonStage, { bg: string; fg: string; border: string }> = {
    new: { bg: colors.surface, fg: colors.primaryDark, border: colors.border },
    progress: { bg: colors.warningSoft, fg: colors.warning, border: colors.warningFill },
    done: { bg: colors.success, fg: colors.white, border: colors.success },
};

const STAGE_TONE = {
    new: "neutral",
    next: "accent",
    progress: "warning",
    done: "success",
} as const;

const STAGE_ICON = {
    new: "ellipse-outline",
    progress: "time",
    done: "checkmark-circle",
} as const;

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
    cardProgress: { borderColor: colors.warningFill, borderWidth: 2 },
    cardDone: { borderColor: colors.success, borderWidth: 1.5 },
    lattice: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" },
    latticeRow: {
        flexDirection: "row",
        alignItems: "center",
        height: LATTICE_STEP,
        gap: LATTICE_STEP - DIAMOND,
        marginLeft: -DIAMOND / 2,
    },
    latticeRowShifted: { marginLeft: LATTICE_STEP / 2 - DIAMOND / 2 },
    diamond: {
        width: DIAMOND,
        height: DIAMOND,
        opacity: 0.16,
        transform: [{ rotate: "45deg" }],
    },
    main: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
    pressed: { opacity: 0.85 },
    icon: {
        width: 52,
        height: 52,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
    },
    mark: {
        position: "absolute",
        right: -6,
        bottom: -6,
        width: 22,
        height: 22,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.surface,
    },
    markDone: { backgroundColor: colors.success },
    markProgress: { backgroundColor: colors.warningFill },
    body: { flex: 1, gap: spacing.xs },
    description: { flexShrink: 1 },
    meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    track: {
        height: 8,
        borderRadius: radius.full,
        backgroundColor: colors.mutedSurface,
        overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.warningFill },
    fillDone: { backgroundColor: colors.success },
    strong: { fontWeight: "600" },
    stages: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
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
    speakOwed: { backgroundColor: colors.warningSoft, borderTopColor: colors.warningFill },
    speakAgain: { backgroundColor: "transparent", borderTopColor: colors.successSoft },
    speakText: { flexShrink: 1 },
});
