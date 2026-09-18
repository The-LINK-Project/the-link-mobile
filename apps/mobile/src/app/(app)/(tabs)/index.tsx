import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { ContinueCard } from "@/components/lessons/ContinueCard";
import { LessonCard } from "@/components/lessons/LessonCard";
import { ErrorState, Screen, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { getDailyMix, getLesson, listLessons } from "@/lib/lessons/data";
import { fingerprint } from "@/lib/lessons/session";
import type { Lesson } from "@/lib/lessons/types";
import { continuePoint, doneToday, lessonStatus } from "@/lib/progress/model";
import { takeResume, useProgressData } from "@/lib/progress/store";
import { practiceLanguages, runFromParams } from "@/lib/speaking/context";
import { useMe } from "@/lib/queries";
import { colors, radius, spacing } from "@/lib/theme";

/** Only the app's own lesson screens may be reopened, and only for a real lesson. */
function resumeTarget(href: string | null): Href | null {
    const match = href?.match(/^\/(lesson|speak)\/([a-z0-9-]+)$/);
    if (!match || !getLesson(match[2])) return null;
    return href as Href;
}

function canSpeak(lesson: Lesson): boolean {
    return practiceLanguages(lesson, runFromParams(lesson, {})).length > 0;
}

// Home is the learner's map: what they left unfinished, what is done, and what
// to take next. The empty state is kept as the fallback for when the catalogue
// is empty, which is what a fresh install will see until lessons are published
// from the API.
//
// The profile sync runs alongside the list rather than in front of it. Lesson
// content does not depend on the profile, so neither a slow network nor an API
// outage may take away the only thing on this screen a learner came here to
// do. A failed sync is reported above the lessons instead of replacing them.
export default function HomeScreen() {
    const t = useFirstLanguageInterface("foundation");
    const l = useFirstLanguageInterface("lessons");
    const router = useRouter();
    const me = useMe();
    const data = useProgressData();
    const lessons = listLessons();
    const mix = getDailyMix();

    // An app the phone closed behind the learner's back reopens where they
    // were. Offered once per launch, and only for a few minutes; see the store.
    useEffect(() => {
        const target = resumeTarget(takeResume());
        if (target) router.push(target);
    }, [router]);

    const all = [...lessons, mix];
    const point = continuePoint(
        data,
        all.map((lesson) => ({ id: lesson.id, fingerprint: fingerprint(lesson) })),
    );
    const continuing = point ? all.find((lesson) => lesson.id === point.lessonId) : undefined;

    const statuses = lessons.map((lesson) => lessonStatus(data, lesson.id, fingerprint(lesson)));
    const done = statuses.filter((s) => s.kind === "learned" || s.kind === "spoken").length;
    // Pointing at a new lesson while another is half done is two instructions.
    const nextIndex = point ? -1 : statuses.findIndex((status) => status.kind === "new");

    const mixStatus = lessonStatus(data, mix.id, fingerprint(mix));
    const mixDone = doneToday(data.progress.lessons[mix.id]);

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

            {point && continuing ? (
                <ContinueCard
                    lesson={continuing}
                    point={point}
                    onPress={() =>
                        router.push(
                            point.kind === "talk"
                                ? `/speak/${point.lessonId}`
                                : `/lesson/${point.lessonId}`,
                        )
                    }
                />
            ) : null}

            {lessons.length > 0 ? (
                <>
                    <View style={styles.section}>
                        <Text variant="heading">{t("lessonsTitle")}</Text>
                        {done === 0 ? (
                            <Text variant="caption">{t("lessonsBody")}</Text>
                        ) : (
                            <View
                                style={styles.overall}
                                accessible
                                accessibilityLabel={l("doneCount", { done, total: lessons.length })}
                            >
                                <View style={styles.track}>
                                    <View
                                        style={[
                                            styles.fill,
                                            { width: `${(done / lessons.length) * 100}%` },
                                        ]}
                                    />
                                </View>
                                <Text variant="caption">
                                    {l("doneCount", { done, total: lessons.length })}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.lessons}>
                        {lessons.map((lesson, index) => {
                            const status = statuses[index];
                            const finished = status.kind === "learned" || status.kind === "spoken";
                            return (
                                <LessonCard
                                    key={lesson.id}
                                    lesson={lesson}
                                    status={status}
                                    next={index === nextIndex}
                                    onSpeak={
                                        finished && canSpeak(lesson)
                                            ? () => router.push(`/speak/${lesson.id}`)
                                            : undefined
                                    }
                                />
                            );
                        })}
                    </View>

                    <View style={styles.section}>
                        <Text variant="heading">{t("practiceTitle")}</Text>
                    </View>
                    <View style={styles.lessons}>
                        <LessonCard
                            lesson={mix}
                            // The mix is new again every morning, so yesterday's
                            // tick must not sit on today's exercises.
                            status={mixStatus.kind === "started" ? mixStatus : { kind: "new" }}
                            doneLabel={mixDone ? l("mixDoneToday") : undefined}
                        />
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
    overall: { gap: spacing.xs, paddingTop: spacing.xs },
    track: {
        height: 8,
        borderRadius: radius.full,
        backgroundColor: colors.mutedSurface,
        overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.primary },
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
