import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { LessonWords } from "@/components/lessons/LessonIntro";
import { LessonHero } from "@/components/lessons/LessonVisual";
import { Badge, Button, Card, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { localized } from "@/lib/lessons/localized";
import type { Lesson } from "@/lib/lessons/types";
import type { LessonRecord } from "@/lib/progress/model";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * A finished lesson, opened again.
 *
 * It used to open on its first question, exactly as it did the first time, and
 * a learner who had done every exercise was left wondering whether any of it
 * had been kept. So it says that the lesson is done and how it went, keeps the
 * words there to look over, and leaves going through it again as a choice.
 */
export function LessonDone({ lesson, record }: { lesson: Lesson; record: LessonRecord }) {
    const t = useFirstLanguageInterface("lessons");

    return (
        <View style={styles.container}>
            <View style={styles.hero}>
                <Text variant="label">{localized(lesson.title, "en")}</Text>
                <View style={styles.title}>
                    <View style={styles.tick}>
                        <Ionicons name="checkmark" size={20} color={colors.white} />
                    </View>
                    <Text variant="title" style={styles.titleText}>
                        {t("summaryTitle")}
                    </Text>
                </View>
                <LessonHero lesson={lesson} />
                <View style={styles.badges}>
                    <Badge
                        label={record.speaking ? t("statusSpoken") : t("statusLearned")}
                        tone="success"
                    />
                </View>
            </View>

            <Card>
                <Text variant="label">{t("summaryFirstTry")}</Text>
                <Text variant="heading">
                    {t("summaryOutOf", { correct: record.bestFirstTry, total: record.total })}
                </Text>
            </Card>

            <View style={styles.section}>
                <Text variant="label">{t("introTitle")}</Text>
                <LessonWords lesson={lesson} />
            </View>
        </View>
    );
}

/** Pinned to the bottom, like every other way forward in a lesson. */
export function LessonDoneActions({
    onAgain,
    onSpeak,
}: {
    onAgain: () => void;
    /** Present when the lesson can be practised aloud. */
    onSpeak?: () => void;
}) {
    const t = useFirstLanguageInterface("lessons");
    if (!onSpeak) return <Button title={t("summaryRetry")} size="lg" onPress={onAgain} />;
    return (
        <View style={styles.actions}>
            <Button
                title={t("summarySpeak")}
                size="lg"
                icon={<Ionicons name="mic" size={20} color={colors.onPrimary} />}
                onPress={onSpeak}
            />
            <Button title={t("summaryRetry")} variant="outline" onPress={onAgain} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl },
    hero: { gap: spacing.md },
    title: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    titleText: { flexShrink: 1 },
    tick: {
        width: 32,
        height: 32,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.success,
    },
    badges: { flexDirection: "row" },
    section: { gap: spacing.sm },
    actions: { gap: spacing.sm },
});
