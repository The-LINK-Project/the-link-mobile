import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { LessonStages } from "@/components/lessons/LessonStages";
import { Badge, Button, Card, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { localized, useFirstLanguageLocalized } from "@/lib/lessons/localized";
import type { SessionSummary } from "@/lib/lessons/session";
import type { Lesson } from "@/lib/lessons/types";
import { colors, spacing } from "@/lib/theme";

/**
 * End-of-lesson screen.
 *
 * Reports what was practised rather than a score out of five. There is no XP,
 * streak or gem economy: those are engagement mechanics for a consumer app with
 * daily habits to build, and they are not what this audience needs from a
 * five-minute lesson taken between shifts.
 *
 * For a lesson with a talk, this is the end of the first stage and not of the
 * lesson, and it must not congratulate the learner on a lesson they have half
 * done: "Lesson done!" here is exactly what let the talk pass for an extra.
 */
export function LessonSummary({
    lesson,
    summary,
    speakingLeft,
    onRetry,
}: {
    lesson: Lesson;
    summary: SessionSummary;
    /** The talk with the tutor is still to come before the lesson is done. */
    speakingLeft: boolean;
    onRetry: () => void;
}) {
    const t = useFirstLanguageInterface("lessons");
    const native = useFirstLanguageLocalized();
    const perfect = summary.reviewed === 0;

    return (
        <View style={styles.container}>
            {/* Names the lesson that was finished, and sits left-aligned like
                every other screen in the app. A centred badge reads as a generic
                congratulations panel that could belong to any product. */}
            <View style={styles.hero}>
                <Text variant="label">{localized(lesson.title, "en")}</Text>
                <Text variant="title">
                    {speakingLeft ? t("summaryStageTitle") : t("summaryTitle")}
                </Text>
                <Text variant="caption">
                    {perfect
                        ? t("summaryPerfect")
                        : t("summaryReviewed", { count: summary.reviewed })}
                </Text>
                {speakingLeft ? (
                    <View style={styles.stages}>
                        <LessonStages learn="done" speak="current" size="lg" />
                        <Text variant="bodyStrong">{t("summarySpeakNext")}</Text>
                    </View>
                ) : null}
            </View>

            <Card>
                <Text variant="label">{t("summaryFirstTry")}</Text>
                <Text variant="heading">
                    {t("summaryOutOf", { correct: summary.firstTryCorrect, total: summary.total })}
                </Text>
            </Card>

            <View style={styles.section}>
                <Text variant="label">{t("summaryPractised")}</Text>
                <View style={styles.terms}>
                    {summary.practisedTerms.map((term) => (
                        <Badge key={term} label={term} />
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text variant="label">{t("summaryNextTime")}</Text>
                {/* Ending on the phrases makes the point of the lesson concrete: these
            are the sentences they can now say at a station. */}
                {summary.phrases.map((phrase) => (
                    <View key={phrase.id} style={styles.phrase}>
                        <Text variant="bodyStrong">{phrase.text}</Text>
                        <Text variant="caption">{native(phrase.meaning)}</Text>
                    </View>
                ))}
            </View>

            {/* The Singapore context notes land here rather than before the
          exercises: after practising the words, "tap out or pay the highest
          fare" is advice about something the learner now has language for. */}
            <View style={styles.section}>
                <Text variant="label">{t("summaryGoodToKnow")}</Text>
                {lesson.notes.map((note) => (
                    <View key={note.id} style={styles.note}>
                        <Ionicons
                            name="ellipse"
                            size={6}
                            color={colors.primaryDark}
                            style={styles.bullet}
                        />
                        <Text variant="caption" style={styles.noteText}>
                            {native(note.text)}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Doing it again is a real choice but never the next step, so it
                waits at the end of the page rather than beside the way forward. */}
            <Button title={t("summaryRetry")} variant="outline" onPress={onRetry} />
        </View>
    );
}

/**
 * The way forward, pinned to the bottom of the screen.
 *
 * It used to sit under everything else, two screens down. A learner who reads
 * little saw a page of text with nothing to press, which is how a finished
 * lesson ends in a closed app. What to do next is now always in view, and the
 * page above it can be read or not.
 *
 * Saying the sentences aloud is the second half of the lesson, so it leads.
 * A learner on a crowded train who cannot speak out loud right now can put it
 * off, and the lesson waits for them, in progress, until they come back to it.
 */
export function LessonSummaryActions({
    speakingLeft,
    onDone,
    onSpeak,
}: {
    /** The talk with the tutor is still to come before the lesson is done. */
    speakingLeft: boolean;
    onDone: () => void;
    /** Present when the lesson can be said aloud. */
    onSpeak?: () => void;
}) {
    const t = useFirstLanguageInterface("lessons");
    if (!onSpeak) return <Button title={t("summaryDone")} size="lg" onPress={onDone} />;
    // Gone through again with the talk already had: the lesson is done, and
    // saying it once more is there for whoever wants it.
    if (!speakingLeft) {
        return (
            <View style={styles.actions}>
                <Button title={t("summaryDone")} size="lg" onPress={onDone} />
                <Button
                    title={t("summarySpeak")}
                    variant="outline"
                    icon={<Ionicons name="mic" size={20} color={colors.foreground} />}
                    onPress={onSpeak}
                />
            </View>
        );
    }
    return (
        <View style={styles.actions}>
            <Button
                title={t("summarySpeak")}
                size="lg"
                icon={<Ionicons name="mic" size={20} color={colors.onPrimary} />}
                onPress={onSpeak}
            />
            <Button title={t("summarySpeakLater")} variant="ghost" onPress={onDone} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl, paddingBottom: spacing.xl },
    hero: { gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.lg },
    stages: { gap: spacing.sm, paddingTop: spacing.md },
    section: { gap: spacing.sm },
    terms: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    phrase: {
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
    },
    note: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
    bullet: { marginTop: 7 },
    noteText: { flex: 1 },
    actions: { gap: spacing.xs },
});
