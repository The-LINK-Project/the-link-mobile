import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { Badge, Button, Card, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { useLocalized } from "@/lib/lessons/localized";
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
 */
type Props = {
    lesson: Lesson;
    summary: SessionSummary;
    onDone: () => void;
    onRetry: () => void;
    /** Present when this run taught something that can be practised aloud. */
    onSpeak?: () => void;
};

export function LessonSummary({ lesson, summary, onRetry }: Omit<Props, "onDone" | "onSpeak">) {
    const t = useTranslations("mobile.lessons");
    const localized = useLocalized();
    const perfect = summary.reviewed === 0;

    return (
        <View style={styles.container}>
            {/* Names the lesson that was finished, and sits left-aligned like
                every other screen in the app. A centred badge reads as a generic
                congratulations panel that could belong to any product. */}
            <View style={styles.hero}>
                <Text variant="label">{localized(lesson.title)}</Text>
                <Text variant="title">{t("summaryTitle")}</Text>
                <Text variant="caption">
                    {perfect
                        ? t("summaryPerfect")
                        : t("summaryReviewed", { count: summary.reviewed })}
                </Text>
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
                        <Text variant="caption">{localized(phrase.meaning)}</Text>
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
                            {localized(note.text)}
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
 * Saying the sentences aloud is the point of the lesson, so it leads. Skipping
 * stays one tap away for a learner on a crowded train who cannot speak out loud
 * right now.
 */
export function LessonSummaryActions({ onDone, onSpeak }: Pick<Props, "onDone" | "onSpeak">) {
    const t = useTranslations("mobile.lessons");
    if (!onSpeak) return <Button title={t("summaryDone")} size="lg" onPress={onDone} />;
    return (
        <View style={styles.actions}>
            <Button
                title={t("summarySpeak")}
                size="lg"
                icon={<Ionicons name="mic" size={20} color={colors.onPrimary} />}
                onPress={onSpeak}
            />
            <Button title={t("summarySkipSpeaking")} variant="ghost" onPress={onDone} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl, paddingBottom: spacing.xl },
    hero: { gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.lg },
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
