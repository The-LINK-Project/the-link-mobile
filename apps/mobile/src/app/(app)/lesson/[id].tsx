import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseRenderer } from "@/components/lessons/ExerciseRenderer";
import { SELF_GRADING } from "@/components/lessons/exercises/shared";
import { LessonFooter } from "@/components/lessons/LessonFooter";
import { LessonProgress } from "@/components/lessons/LessonProgress";
import { LessonSummary } from "@/components/lessons/LessonSummary";
import { ErrorState, Screen, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { getLesson } from "@/lib/lessons/data";
import { useLocalized } from "@/lib/lessons/localized";
import { useLessonSession } from "@/lib/lessons/session";
import { colors, spacing, TOUCH_TARGET } from "@/lib/theme";

/**
 * One lesson session.
 *
 * This screen owns no exercise logic. It resolves the lesson, drives the
 * session reducer, and hands whatever exercise is current to the renderer. Any
 * lesson with any mix of exercise types plays through this same route, which is
 * why adding a type never touches this file.
 *
 * Content currently comes from `lib/lessons/data`. When the API is ready this
 * becomes a query and the rest of the screen is unchanged.
 */
export default function LessonScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const lesson = getLesson(id);

    if (!lesson) {
        return (
            <Screen>
                <ErrorState message={`Lesson "${id}" was not found.`} />
            </Screen>
        );
    }

    return <LessonRunner lessonId={lesson.id} />;
}

function LessonRunner({ lessonId }: { lessonId: string }) {
    const t = useTranslations("mobile.lessons");
    const localized = useLocalized();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    // Non-null: the parent only renders this once the lesson has resolved.
    const lesson = getLesson(lessonId)!;

    const {
        state,
        exercise,
        progress,
        isLastStep,
        setDraft,
        submit,
        submitAnswer,
        next,
        restart,
        summary,
    } = useLessonSession(lesson);

    const confirmQuit = useCallback(() => {
        Alert.alert(t("quitTitle"), t("quitBody"), [
            { text: t("quitStay"), style: "cancel" },
            { text: t("quitLeave"), style: "destructive", onPress: () => router.back() },
        ]);
    }, [t, router]);

    if (state.phase === "finished") {
        return (
            <Screen edges={["top", "left", "right"]}>
                <LessonSummary
                    lesson={lesson}
                    summary={summary}
                    onDone={() => router.back()}
                    onRetry={restart}
                />
            </Screen>
        );
    }

    if (!exercise) {
        return (
            <Screen>
                <ErrorState message={t("exerciseMissing")} />
            </Screen>
        );
    }

    const selfGrading = SELF_GRADING.has(exercise.type);

    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("quit")}
                    onPress={confirmQuit}
                    style={styles.close}
                    hitSlop={8}
                >
                    <Ionicons name="close" size={28} color={colors.muted} />
                </Pressable>
                <LessonProgress value={progress} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text variant="subheading">{localized(exercise.instruction)}</Text>

                <ExerciseRenderer
                    exercise={exercise}
                    lesson={lesson}
                    draft={state.draft}
                    onDraftChange={setDraft}
                    onSelfSubmit={submitAnswer}
                    result={state.result}
                    locked={state.phase === "graded"}
                />
            </ScrollView>

            <View style={{ paddingBottom: insets.bottom }}>
                <LessonFooter
                    phase={state.phase === "graded" ? "graded" : "answering"}
                    canSubmit={state.draft !== null}
                    result={state.result}
                    onSubmit={submit}
                    onNext={next}
                    isLastStep={isLastStep}
                    hideSubmit={selfGrading}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    close: {
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        flexGrow: 1,
        gap: spacing.xl,
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
    },
});
