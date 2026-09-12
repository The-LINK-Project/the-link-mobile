import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { LessonCard } from "@/components/lessons/LessonCard";
import { ErrorState, LoadingState, Screen, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { listLessons } from "@/lib/lessons/data";
import { useMe } from "@/lib/queries";
import { colors, spacing } from "@/lib/theme";

// Home lists the lessons available to the learner. The empty state is kept as
// the fallback for when the catalogue is empty, which is what a fresh install
// will see until lessons are published from the API.
//
// A failed profile sync is reported above the lessons rather than instead of
// them. Lesson content does not depend on the profile, so an API outage must
// not take away the only thing on this screen a learner came here to do.
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

            {me.isPending ? (
                <LoadingState />
            ) : lessons.length > 0 ? (
                <View style={styles.lessons}>
                    {lessons.map((lesson) => (
                        <LessonCard key={lesson.id} lesson={lesson} />
                    ))}
                </View>
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
    content: { paddingTop: spacing.xl },
    header: { gap: spacing.lg },
    lessons: { gap: spacing.md, paddingTop: spacing.xl },
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
