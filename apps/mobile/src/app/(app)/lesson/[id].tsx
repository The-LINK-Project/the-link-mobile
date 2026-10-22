import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseRenderer } from "@/components/lessons/ExerciseRenderer";
import { SELF_GRADING } from "@/components/lessons/exercises/shared";
import { LessonDone, LessonDoneActions } from "@/components/lessons/LessonDone";
import { LessonFooter } from "@/components/lessons/LessonFooter";
import { LessonIntro } from "@/components/lessons/LessonIntro";
import { LessonProgress } from "@/components/lessons/LessonProgress";
import { LessonSummary, LessonSummaryActions } from "@/components/lessons/LessonSummary";
import { RestartButton, RestartConfirm } from "@/components/lessons/RestartLesson";
import { WithBack } from "@/components/lessons/StepNav";
import { Button, ErrorState, LoadingState, PressGuard, Screen, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { goBack } from "@/lib/navigation";
import { getLesson } from "@/lib/lessons/data";
import { useFirstLanguageLocalized } from "@/lib/lessons/localized";
import { DAILY_MIX_ID } from "@/lib/lessons/data/review";
import { restoreSession, snapshotOf, useLessonSession } from "@/lib/lessons/session";
import type { LessonRecord, SavedRun } from "@/lib/progress/model";
import {
    clearRun,
    completeLesson,
    getProgressData,
    saveRun,
    setResume,
} from "@/lib/progress/store";
import { canPractiseSpeaking, practiceLanguages, runToParams } from "@/lib/speaking/context";
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
    const t = useFirstLanguageInterface("lessons");
    const { id } = useLocalSearchParams<{ id: string }>();
    const lesson = getLesson(id);
    // Picture exercises are left out for screen-reader users, because the tiles
    // deliberately do not name themselves and a label would read the answer aloud.
    const screenReader = useScreenReader();

    if (!lesson) {
        return (
            <Screen>
                <ErrorState message={t("lessonMissing")} />
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
 * One coming back to a lesson they have finished is told so, and is not dropped
 * into its first question as though nothing had been kept.
 */
function LessonFlow({ lessonId, screenReader }: { lessonId: string; screenReader: boolean }) {
    const t = useFirstLanguageInterface("lessons");
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const lesson = getLesson(lessonId)!;
    // Read when the runner starts, not on every render. The run is saved again
    // on every answer, and re-reading it would restart the session underneath
    // the learner each time.
    const readSaved = (): SavedRun | undefined => {
        const run = getProgressData().runs[lessonId];
        return run && restoreSession(lesson, run, screenReader) ? run : undefined;
    };
    const [saved, setSaved] = useState<SavedRun | undefined>(readSaved);
    // Read when this screen shows, too, or finishing the lesson here would swap
    // the summary for this screen's "done" view the moment the result was
    // recorded. The daily mix is new every morning, so yesterday's finish says
    // nothing about today's. A record with no exercises in it came from
    // speaking alone.
    const readRecord = (): LessonRecord | undefined => {
        const found = getProgressData().progress.lessons[lessonId];
        return lessonId !== DAILY_MIX_ID && found && found.total > 0 ? found : undefined;
    };
    const [record, setRecord] = useState<LessonRecord | undefined>(readRecord);
    // The daily mix draws on every lesson's words, far too many to list, and
    // all of them already met in the lesson they came from. A review steps back
    // through a finished lesson from its results.
    const [mode, setMode] = useState<"start" | "run" | "review">(
        saved !== undefined || lessonId === DAILY_MIX_ID ? "run" : "start",
    );

    if (mode !== "start") {
        return (
            <LessonRunner
                lessonId={lessonId}
                screenReader={screenReader}
                saved={saved}
                review={mode === "review"}
                // Back from the first exercise is the word list, or the results
                // for a finished lesson. The daily mix has neither, so it starts
                // on its first exercise and stays there.
                onBackToStart={
                    lessonId === DAILY_MIX_ID
                        ? undefined
                        : () => {
                              // Picked up again from where the learner had got to,
                              // and a lesson just finished opens on its results.
                              setSaved(readSaved());
                              setRecord(readRecord());
                              setMode("start");
                          }
                }
            />
        );
    }

    const canSpeak = canPractiseSpeaking(lesson);
    // The talk is the lesson's second stage, so without it the lesson is
    // in progress, and its way forward is the talk rather than a second run.
    const speakingLeft = canSpeak && !record?.speaking;
    // Another go already part-way through is carried on, and says so. Only one
    // that can be picked up again: a run kept from before a screen reader was
    // switched on, say, is started afresh, so it must not promise Continue.
    const resuming = saved !== undefined && saved.position > 0;

    return (
        <SafeAreaView edges={["top"]} style={styles.root}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("quit")}
                    onPress={() => goBack(router)}
                    style={styles.close}
                    hitSlop={8}
                >
                    <Ionicons name="close" size={28} color={colors.muted} />
                </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {record ? (
                    <LessonDone lesson={lesson} record={record} speakingLeft={speakingLeft} />
                ) : (
                    <LessonIntro lesson={lesson} />
                )}
            </ScrollView>
            <View style={[styles.introFooter, { paddingBottom: insets.bottom + spacing.lg }]}>
                {/* A double tap that brought the learner here does not go on to
                    press what is now under their finger (see PressGuard). */}
                <PressGuard settleKey="start">
                    {/* The word list is the lesson's first step, so Back is the way
                        home. The results of a finished lesson go back to its last
                        exercise. */}
                    <WithBack onBack={record ? () => setMode("review") : () => goBack(router)}>
                        {record ? (
                            <LessonDoneActions
                                onAgain={() => setMode("run")}
                                resuming={resuming}
                                onSpeak={
                                    canSpeak
                                        ? () => router.replace(`/speak/${lesson.id}`)
                                        : undefined
                                }
                            />
                        ) : (
                            <Button
                                title={t("introStart")}
                                size="lg"
                                onPress={() => setMode("run")}
                            />
                        )}
                    </WithBack>
                </PressGuard>
            </View>
        </SafeAreaView>
    );
}

function LessonRunner({
    lessonId,
    screenReader,
    saved,
    review = false,
    onBackToStart,
}: {
    lessonId: string;
    screenReader: boolean;
    saved?: SavedRun;
    /** Stepping back through a finished lesson, from its results. */
    review?: boolean;
    /** Back from the first exercise, and the end of a review. */
    onBackToStart?: () => void;
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
        revisiting,
        setDraft,
        submit,
        submitAnswer,
        next,
        back,
        restart,
        summary,
    } = useLessonSession(lesson, screenReader, saved, review);

    // Every answer is written down as it happens. The phone may close the app
    // at any moment without telling it, so there is no later to save in.
    const recorded = useRef(false);
    useEffect(() => {
        // A review changes nothing: it is not a place to come back to, and
        // reaching its end is not finishing the lesson a second time.
        if (review) return;
        const snapshot = snapshotOf(state);
        // The lesson is finished by its last answer, not by pressing Continue
        // under it. Waiting for that press lost the lesson for a learner who
        // answered everything and then closed the app on the feedback: the run
        // kept on the phone still pointed at the last exercise, and they came
        // back to do it again. An empty run is over before it starts.
        if (snapshot.position >= snapshot.queue.length) {
            if (recorded.current) return;
            recorded.current = true;
            completeLesson(lessonId, {
                firstTryCorrect: summary.firstTryCorrect,
                total: summary.total,
            });
            return;
        }
        recorded.current = false;
        // Nothing answered yet: there is no place to keep.
        if (snapshot.position === 0) return;
        saveRun(lessonId, snapshot, `/lesson/${lessonId}`);
    }, [review, state, lessonId, summary.firstTryCorrect, summary.total]);

    // The end of a review is the results it started from.
    const reviewOver = review && state.phase === "finished";
    useEffect(() => {
        if (reviewOver) onBackToStart?.();
    }, [reviewOver, onBackToStart]);

    // Leaving by choice lands on Home next time. Only an app that was closed
    // underneath the learner reopens inside the lesson.
    useEffect(() => () => setResume(null), []);

    // No "are you sure?": the place is kept, so leaving costs nothing, and a
    // dialog of English-shaped choices is one more thing to read.
    const leave = useCallback(() => goBack(router), [router]);

    // From the first exercise, with the saved place forgotten too: a fresh run
    // saves nothing until its first answer, so the old place would come back.
    // Offered once there is an answer to lose, and not in a review, which
    // changes nothing. Each fresh run is a new round, so an exercise on screen
    // before and after starting again is still drawn afresh.
    const [round, setRound] = useState(0);
    // Which exercise the restart question was asked over. A question asked
    // about one exercise is not left open over the next.
    const step = `${round}-${state.position}`;
    const [confirmingAt, setConfirmingAt] = useState<string | null>(null);
    const startOver = useCallback(() => {
        clearRun(lessonId);
        restart();
        setRound((value) => value + 1);
        setConfirmingAt(null);
    }, [lessonId, restart]);
    const canRestart = !review && state.reached > 0;
    const asking = confirmingAt === step && canRestart;

    if (reviewOver) return null;

    if (state.phase === "finished") {
        const run = {
            vocabIds: summary.practisedVocabIds,
            phraseIds: summary.phrases.map((phrase) => phrase.id),
        };
        // What this run taught is what gets said. A run that taught nothing
        // sayable (none does today) must not strand a lesson that has a talk:
        // the talk then takes the whole lesson as taught.
        const ownTalk = practiceLanguages(lesson, run).length > 0;
        const canSpeak = ownTalk || canPractiseSpeaking(lesson);
        const spoken = getProgressData().progress.lessons[lessonId]?.speaking !== undefined;
        return (
            <SafeAreaView edges={["top"]} style={styles.root}>
                <Stack.Screen options={{ headerShown: false }} />
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <LessonSummary
                        lesson={lesson}
                        summary={summary}
                        speakingLeft={canSpeak && !spoken}
                        onRetry={restart}
                    />
                </ScrollView>
                <View style={[styles.introFooter, { paddingBottom: insets.bottom + spacing.lg }]}>
                    {/* Practise speaking sits where Finish was: a double tap on
                        Finish must not skip these results (see PressGuard). */}
                    <PressGuard settleKey="results">
                        {/* Back to the last exercise, to look at it again. */}
                        <WithBack onBack={back}>
                            <LessonSummaryActions
                                speakingLeft={canSpeak && !spoken}
                                onDone={() => goBack(router)}
                                // Replaces the lesson rather than stacking on top
                                // of it, so finishing the practice goes straight home.
                                onSpeak={
                                    canSpeak
                                        ? () =>
                                              router.replace({
                                                  pathname: "/speak/[id]",
                                                  params: {
                                                      id: lesson.id,
                                                      ...(ownTalk ? runToParams(run) : {}),
                                                  },
                                              })
                                        : undefined
                                }
                            />
                        </WithBack>
                    </PressGuard>
                </View>
            </SafeAreaView>
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
        <SafeAreaView edges={["top"]} style={styles.root}>
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
                {canRestart ? (
                    <RestartButton
                        open={asking}
                        onPress={() => setConfirmingAt(asking ? null : step)}
                    />
                ) : null}
            </View>

            <ScrollView
                // A new exercise opens at its top. The answers sit low and get
                // scrolled to, and the next one would otherwise open scrolled
                // past its own instruction. Grading leaves the scroll be.
                key={step}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text variant="heading">{localized(exercise.instruction)}</Text>

                <ExerciseRenderer
                    // A fresh component per queue position: an exercise that
                    // comes back after a miss, or is stepped back to, starts
                    // again rather than showing its old answer.
                    key={`${round}-${state.position}-${exercise.id}`}
                    exercise={exercise}
                    lesson={lesson}
                    draft={state.draft}
                    onDraftChange={setDraft}
                    onSelfSubmit={submitAnswer}
                    result={state.result}
                    locked={state.phase === "graded"}
                    // A second showing after a miss: its options in a new order.
                    again={state.queue.indexOf(exercise.id) < state.position}
                />
            </ScrollView>

            <View style={{ paddingBottom: insets.bottom }}>
                {/* Check sits where Continue appears, and Continue where the next
                    Check does: a double tap is let fall rather than taken as
                    two answers (see PressGuard). The restart question too. */}
                <PressGuard settleKey={`${step}-${state.phase}-${asking ? "ask" : ""}`}>
                    {asking ? (
                        <RestartConfirm
                            onRestart={startOver}
                            onCancel={() => setConfirmingAt(null)}
                        />
                    ) : (
                        <LessonFooter
                            phase={state.phase === "graded" ? "graded" : "answering"}
                            canSubmit={state.draft !== null}
                            result={state.result}
                            onSubmit={submit}
                            onNext={next}
                            isLastStep={isLastStep}
                            hideSubmit={selfGrading}
                            onBack={state.position > 0 ? back : onBackToStart}
                            revisiting={revisiting}
                        />
                    )}
                </PressGuard>
            </View>
        </SafeAreaView>
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
