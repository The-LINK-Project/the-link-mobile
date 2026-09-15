import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { LessonCard } from "@/components/lessons/LessonCard";
import { ErrorState, Screen, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { getDailyMix, listLessons } from "@/lib/lessons/data";
import { useMe } from "@/lib/queries";
import { colors, spacing } from "@/lib/theme";

// Home lists the lessons available to the learner. The empty state is kept as
// the fallback for when the catalogue is empty, which is what a fresh install
// will see until lessons are published from the API.
//
// The profile sync runs alongside the list rather than in front of it. Lesson
// content does not depend on the profile, so neither a slow network nor an API
// outage may take away the only thing on this screen a learner came here to
// do. A failed sync is reported above the lessons instead of replacing them.
export default function HomeScreen() {
    const t = useTranslations("mobile.foundation");
    const me = useMe();
    const lessons = listLessons();

    return (
        <Screen edges={["top", "left", "right"]} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Image
                    source={require("../../../../assets/images/icon.png")}
                    style={styles.logo}
                    accessibilityLabel="The LINK Project"
                />
                <Text variant="title">{t("welcome")}</Text>
            </View>

            {me.isError ? (
                <ErrorState message={t("syncError")} onRetry={() => void me.refetch()} />
            ) : null}

            {lessons.length > 0 ? (
                <>
                    <View style={styles.section}>
                        <Text variant="heading">{t("lessonsTitle")}</Text>
                        <Text variant="caption">{t("lessonsBody")}</Text>
                    </View>
                    <View style={styles.lessons}>
                        {lessons.map((lesson) => (
                            <LessonCard key={lesson.id} lesson={lesson} />
                        ))}
                    </View>

                    <View style={styles.section}>
                        <Text variant="heading">{t("practiceTitle")}</Text>
                    </View>
                    <View style={styles.lessons}>
                        <LessonCard lesson={getDailyMix()} />
                    </View>
                </>
            ) : (
                <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                        <Ionicons name="sparkles-outline" size={28} color={colors.primaryDark} />
                    </View>
                    <Text variant="heading" center>
                        {t("empty")}
                    </Text>
                    <Text variant="caption" center style={styles.emptyBody}>
                        {t("emptyBody")}
                    </Text>
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: { paddingTop: spacing.xl, gap: spacing.lg },
    header: { gap: spacing.lg },
    section: { gap: spacing.xs, paddingTop: spacing.sm },
    lessons: { gap: spacing.md },
    logo: { width: 56, height: 56, borderRadius: 14 },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingVertical: spacing.xxl,
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
        marginBottom: spacing.sm,
    },
    emptyBody: { maxWidth: 280 },
});
