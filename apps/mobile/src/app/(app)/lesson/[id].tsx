import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseRenderer } from "@/components/lessons/ExerciseRenderer";
import { SELF_GRADING } from "@/components/lessons/exercises/shared";
import { LessonFooter } from "@/components/lessons/LessonFooter";
import { LessonIntro } from "@/components/lessons/LessonIntro";
import { LessonProgress } from "@/components/lessons/LessonProgress";
import { LessonSummary, LessonSummaryActions } from "@/components/lessons/LessonSummary";
import { Button, ErrorState, LoadingState, Screen, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { getLesson } from "@/lib/lessons/data";
import { DAILY_MIX_ID } from "@/lib/lessons/data/review";
import { useFirstLanguageLocalized } from "@/lib/lessons/localized";
import { restoreSession, snapshotOf, useLessonSession } from "@/lib/lessons/session";
import type { SavedRun } from "@/lib/progress/model";
import { completeLesson, getProgressData, saveRun, setResume } from "@/lib/progress/store";
import { practiceLanguages, runToParams } from "@/lib/speaking/context";
import { colors, spacing, TOUCH_TARGET } from "@/lib/theme";
import { useScreenReader } from "@/lib/useScreenReader";

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
    // Picture exercises are left out for screen-reader users, because the tiles
    // deliberately do not name themselves and a label would read the answer aloud.
    const screenReader = useScreenReader();

    if (!lesson) {
        return (
            <Screen>
                <ErrorState message={`Lesson "${id}" was not found.`} />
            </Screen>
        );
    }

    // The run is built once, and which exercises it contains depends on this,
    // so wait rather than building a queue and correcting it a frame later.
    if (screenReader === null) {
        return (
            <Screen>
                <LoadingState />
            </Screen>
        );
    }

    return <LessonFlow lessonId={lesson.id} screenReader={screenReader} />;
}

/**
 * Words first, then the exercises. A learner coming back to a run they had
 * started goes straight to where they were: they have met the words already.
 */
function LessonFlow({ lessonId, screenReader }: { lessonId: string; screenReader: boolean }) {
    const t = useFirstLanguageInterface("lessons");
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const lesson = getLesson(lessonId)!;
    // Read once. The run is saved again on every answer, and re-reading it
    // would restart the session underneath the learner each time.
    const [saved] = useState<SavedRun | undefined>(() => {
        const run = getProgressData().runs[lessonId];
        return run && restoreSession(lesson, run, screenReader) ? run : undefined;
    });
    // The daily mix draws on every lesson's words, far too many to list, and
    // all of them already met in the lesson they came from.
    const [started, setStarted] = useState(saved !== undefined || lessonId === DAILY_MIX_ID);

    if (started)
        return <LessonRunner lessonId={lessonId} screenReader={screenReader} saved={saved} />;

    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("quit")}
                    onPress={() => router.back()}
                    style={styles.close}
                    hitSlop={8}
                >
                    <Ionicons name="close" size={28} color={colors.muted} />
                </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <LessonIntro lesson={lesson} />
            </ScrollView>
            <View style={[styles.introFooter, { paddingBottom: insets.bottom + spacing.lg }]}>
                <Button title={t("introStart")} size="lg" onPress={() => setStarted(true)} />
            </View>
        </View>
    );
}

function LessonRunner({
    lessonId,
    screenReader,
    saved,
}: {
    lessonId: string;
    screenReader: boolean;
    saved?: SavedRun;
}) {
    const t = useFirstLanguageInterface("lessons");
    const localized = useFirstLanguageLocalized();
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
    } = useLessonSession(lesson, screenReader, saved);

    // Every answer is written down as it happens. The phone may close the app
    // at any moment without telling it, so there is no later to save in.
    const recorded = useRef(false);
    useEffect(() => {
        if (state.phase === "finished") {
            if (recorded.current) return;
            recorded.current = true;
            completeLesson(lessonId, {
                firstTryCorrect: summary.firstTryCorrect,
                total: summary.total,
            });
            return;
        }
        recorded.current = false;
        const snapshot = snapshotOf(state);
        // Nothing answered yet: there is no place to keep.
        if (snapshot.position === 0) return;
        // The last answer of a run is its end, not a place to come back to;
        // the finished branch above records it a moment later.
        if (snapshot.position >= snapshot.queue.length) return;
        saveRun(lessonId, snapshot, `/lesson/${lessonId}`);
    }, [state, lessonId, summary.firstTryCorrect, summary.total]);

    // Leaving by choice lands on Home next time. Only an app that was closed
    // underneath the learner reopens inside the lesson.
    useEffect(() => () => setResume(null), []);

    // No "are you sure?": the place is kept, so leaving costs nothing, and a
    // dialog of English-shaped choices is one more thing to read.
    const leave = useCallback(() => router.back(), [router]);

    if (state.phase === "finished") {
        const run = {
            vocabIds: summary.practisedVocabIds,
            phraseIds: summary.phrases.map((phrase) => phrase.id),
        };
        const canSpeak = practiceLanguages(lesson, run).length > 0;
        return (
            <View style={[styles.root, { paddingTop: insets.top }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <LessonSummary lesson={lesson} summary={summary} onRetry={restart} />
                </ScrollView>
                <View style={[styles.introFooter, { paddingBottom: insets.bottom + spacing.lg }]}>
                    <LessonSummaryActions
                        onDone={() => router.back()}
                        // Replaces the lesson rather than stacking on top of it,
                        // so finishing the practice goes straight home.
                        onSpeak={
                            canSpeak
                                ? () =>
                                      router.replace({
                                          pathname: "/speak/[id]",
                                          params: { id: lesson.id, ...runToParams(run) },
                                      })
                                : undefined
                        }
                    />
                </View>
            </View>
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
                    onPress={leave}
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
    introFooter: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: colors.surface,
    },
    content: {
        flexGrow: 1,
        gap: spacing.xl,
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
    },
});
