import Ionicons from "@expo/vector-icons/Ionicons";
import { requestRecordingPermissionsAsync } from "expo-audio";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LessonProgress } from "@/components/lessons/LessonProgress";
import { ChatBubble } from "@/components/speaking/ChatBubble";
import { RecordBar } from "@/components/speaking/RecordBar";
import { SpeakingIntro } from "@/components/speaking/SpeakingIntro";
import { SpeakingSummary } from "@/components/speaking/SpeakingSummary";
import { Button, ErrorState, LoadingState, Screen, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { useFirstLanguage } from "@/lib/firstLanguage/store";
import { useLocale } from "@/lib/i18n";
import { getLesson } from "@/lib/lessons/data";
import { useLocalized } from "@/lib/lessons/localized";
import type { Lesson } from "@/lib/lessons/types";
import {
    buildSpeakingContext,
    practiceLanguages,
    runFromParams,
    type PractisedRun,
    type SpeakingContext,
    type TutorLanguage,
} from "@/lib/speaking/context";
import type { SavedTalk } from "@/lib/progress/model";
import {
    clearTalk,
    completeSpeaking,
    getProgressData,
    saveTalk,
    setResume,
} from "@/lib/progress/store";
import { restoreConversation, saidCount } from "@/lib/speaking/conversation";
import { micSettleMs } from "@/lib/speaking/microphone";
import { usePlayback } from "@/lib/speaking/playback";
import { useRecorder } from "@/lib/speaking/recorder";
import { useSpeakingSession } from "@/lib/speaking/useSpeakingSession";
import { colors, spacing, TOUCH_TARGET } from "@/lib/theme";
import { useScreenReader } from "@/lib/useScreenReader";

/**
 * Speaking practice after a lesson.
 *
 * The learner chooses the language they speak, then has a short spoken role-play
 * with a tutor who talks in that language and uses only the English this run
 * taught. The exercises taught what the words mean; this is where they get said.
 */
export default function SpeakScreen() {
    const t = useFirstLanguageInterface("speaking");
    const { id, words, phrases } = useLocalSearchParams<{
        id: string;
        words?: string;
        phrases?: string;
    }>();
    const lesson = getLesson(id);
    const screenReader = useScreenReader();
    const run = useMemo(
        () => (lesson ? runFromParams(lesson, { words, phrases }) : null),
        [lesson, words, phrases],
    );

    if (!lesson || !run) {
        return (
            <Screen>
                <ErrorState message={`Lesson "${id}" was not found.`} />
            </Screen>
        );
    }

    const languages = practiceLanguages(lesson, run);
    if (languages.length === 0) {
        return (
            <Screen>
                <ErrorState message={t("nothingToPractise")} />
            </Screen>
        );
    }

    if (screenReader === null) {
        return (
            <Screen>
                <LoadingState />
            </Screen>
        );
    }

    return (
        <SpeakingFlow lesson={lesson} run={run} languages={languages} screenReader={screenReader} />
    );
}

function SpeakingFlow({
    lesson,
    run,
    languages,
    screenReader,
}: {
    lesson: Lesson;
    run: PractisedRun;
    languages: TutorLanguage[];
    screenReader: boolean;
}) {
    const t = useFirstLanguageInterface("speaking");
    const localized = useLocalized();
    const router = useRouter();
    const [locale] = useLocale();
    const [firstLanguage] = useFirstLanguage();
    const insets = useSafeAreaInsets();
    const [chosen, setChosen] = useState<TutorLanguage | null>(null);
    // A talk left unfinished is carried on with, not offered as a choice: the
    // learner asked to practise speaking, and this is them practising speaking.
    const [saved, setSaved] = useState<SavedTalk | undefined>(() => {
        const talk = getProgressData().talks[lesson.id];
        return talk && restoreConversation(talk.context, talk.state) ? talk : undefined;
    });
    const [context, setContext] = useState<SpeakingContext | null>(saved?.context ?? null);
    /** Bumped to begin again, so the conversation starts from nothing. */
    const [round, setRound] = useState(0);
    const [micBlocked, setMicBlocked] = useState(false);

    // The language the learner named as the one they know best comes first: they
    // said so in so many words, and they may well be reading the app in English
    // anyway. The app's language is the next best guess. Either only counts when
    // the tutor can teach from it, and both are only a starting point: the list
    // above is still there to be tapped.
    const language =
        chosen ??
        languages.find((option) => option === firstLanguage) ??
        languages.find((option) => option === locale) ??
        null;

    const start = useCallback(async () => {
        if (!language) return;
        // Asked before the tutor starts, so the permission dialog never
        // interrupts the conversation itself.
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
            setMicBlocked(true);
            return;
        }
        setContext(buildSpeakingContext(lesson, run, language));
    }, [language, lesson, run]);

    if (context) {
        return (
            <Conversation
                key={round}
                lesson={lesson}
                context={context}
                saved={saved}
                screenReader={screenReader}
                onAgain={() => {
                    clearTalk(lesson.id);
                    setSaved(undefined);
                    setContext(null);
                    setRound((value) => value + 1);
                }}
            />
        );
    }

    const preview = buildSpeakingContext(lesson, run, language ?? languages[0]);

    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <CloseButton label={t("close")} onPress={() => router.back()} />
            </View>
            <ScrollView contentContainerStyle={styles.intro} showsVerticalScrollIndicator={false}>
                <SpeakingIntro
                    title={localized(lesson.title)}
                    targets={preview?.goals.map((goal) => goal.target) ?? []}
                    language={language}
                    onLanguageChange={setChosen}
                    micBlocked={micBlocked}
                />
            </ScrollView>
            {/* Pinned, like every other way forward in a lesson: on a small
                phone the button used to sit below the privacy notes, out of sight. */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
                <Button
                    title={t("start")}
                    size="lg"
                    disabled={!language}
                    accessibilityHint={language ? undefined : t("chooseLanguage")}
                    onPress={start}
                />
            </View>
        </View>
    );
}

function Conversation({
    lesson,
    context,
    saved,
    screenReader,
    onAgain,
}: {
    lesson: Lesson;
    context: SpeakingContext;
    saved?: SavedTalk;
    screenReader: boolean;
    onAgain: () => void;
}) {
    const t = useFirstLanguageInterface("speaking");
    const localized = useLocalized();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { state, takeTurn } = useSpeakingSession(context, saved?.state);
    const recorder = useRecorder();
    const voice = usePlayback();
    const review = usePlayback();
    const [notice, setNotice] = useState<string | null>(null);
    const [preparing, setPreparing] = useState(false);
    const [reading, setReading] = useState(false);
    const operation = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const [showSummary, setShowSummary] = useState(false);
    const scroll = useRef<ScrollView>(null);
    const autoplayed = useRef<string | null>(null);

    // Each new tutor line plays by itself, the way a person would simply speak,
    // and it can always be stopped. Not under a screen reader, which would be
    // talking at the same time.
    const latest = state.messages[state.messages.length - 1];
    const playVoice = voice.play;
    useEffect(() => {
        if (screenReader || latest?.role !== "tutor" || !latest.audioUri) return;
        if (autoplayed.current === latest.id) return;
        autoplayed.current = latest.id;
        playVoice(latest.audioUri);
    }, [latest, playVoice, screenReader]);

    // The talk is written down after every turn, and recorded as done the
    // moment the last goal is, not when the results screen is dismissed: a
    // learner who closes the app on "well done" has still done it.
    const recorded = useRef(false);
    useEffect(() => {
        if (state.phase === "finished") {
            if (recorded.current) return;
            recorded.current = true;
            completeSpeaking(lesson.id, { said: saidCount(state), total: state.goalCount });
        } else if (state.phase === "ready") {
            saveTalk(lesson.id, { context, state }, `/speak/${lesson.id}`);
        }
    }, [state, context, lesson.id]);

    useEffect(() => () => setResume(null), []);

    // The talk is kept, so leaving needs no warning.
    const quit = useCallback(() => router.back(), [router]);

    const record = async () => {
        if (operation.current) return;
        operation.current = true;
        setPreparing(true);
        voice.stop();
        review.stop();
        setNotice(null);
        try {
            const settle = micSettleMs(Math.min(voice.quietForMs(), review.quietForMs()));
            if (settle > 0) await new Promise((resolve) => setTimeout(resolve, settle));
            if (!mounted.current) return;
            const result = await recorder.start();
            if (!mounted.current) return;
            if (result === "denied") setNotice(t("micBlocked"));
            if (result === "failed") setNotice(t("recordFailed"));
        } finally {
            operation.current = false;
            if (mounted.current) setPreparing(false);
        }
    };

    const send = async () => {
        if (operation.current) return;
        operation.current = true;
        setReading(true);
        voice.stop();
        review.stop();
        setNotice(null);
        try {
            const audio = await recorder.read();
            if (!mounted.current) return;
            if (!audio) throw new Error("Recording is unavailable");
            if (await takeTurn(audio)) recorder.discard();
        } catch {
            if (mounted.current) setNotice(t("sendFailed"));
        } finally {
            operation.current = false;
            if (mounted.current) setReading(false);
        }
    };

    if (showSummary) {
        return (
            <Screen edges={["top", "left", "right"]}>
                <Stack.Screen options={{ headerShown: false }} />
                <SpeakingSummary
                    title={localized(lesson.title)}
                    goals={context.goals.map((goal, index) => ({
                        id: goal.id,
                        target: goal.target,
                        result: state.results[index] ?? "helped",
                    }))}
                    onDone={() => router.back()}
                    onAgain={onAgain}
                />
            </Screen>
        );
    }

    const opening = state.phase === "opening";
    const goalLabel = {
        current: Math.min(state.results.length + 1, state.goalCount),
        total: state.goalCount,
    };
    const busyLabel = preparing
        ? t("micStarting")
        : opening && !state.error
          ? t("starting")
          : reading || state.phase === "sending"
            ? t("thinking")
            : null;

    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <CloseButton label={t("close")} onPress={quit} />
                <LessonProgress value={state.results.length / state.goalCount} />
                {/* A bar says "some of it"; a number says when it ends, which is
                    what somebody with ten minutes of break left wants to know. */}
                <Text variant="caption" accessibilityLabel={t("goalCount", goalLabel)}>
                    {`${goalLabel.current}/${goalLabel.total}`}
                </Text>
            </View>

            <ScrollView
                ref={scroll}
                contentContainerStyle={styles.chat}
                onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
            >
                {state.messages.map((message) => (
                    <ChatBubble
                        key={message.id}
                        message={message}
                        disabled={preparing || recorder.status === "recording"}
                        playing={!!message.audioUri && voice.playingUri === message.audioUri}
                        onPlay={(speed) => {
                            if (
                                !message.audioUri ||
                                operation.current ||
                                recorder.status === "recording"
                            )
                                return;
                            review.stop();
                            voice.play(message.audioUri, speed);
                        }}
                        onStop={voice.stop}
                    />
                ))}

                {state.error ? (
                    <View style={styles.error}>
                        <Text variant="caption" center>
                            {t(state.error)}
                        </Text>
                        {opening ? (
                            <Button
                                title={t("retry")}
                                variant="outline"
                                onPress={() => void takeTurn()}
                            />
                        ) : null}
                    </View>
                ) : null}
            </ScrollView>

            <View style={{ paddingBottom: insets.bottom }}>
                {state.phase === "finished" ? (
                    <View style={styles.footer}>
                        <Button
                            title={t("seeResults")}
                            size="lg"
                            onPress={() => {
                                voice.stop();
                                setShowSummary(true);
                            }}
                        />
                    </View>
                ) : opening && state.error ? null : (
                    <RecordBar
                        status={recorder.status}
                        durationMs={recorder.durationMs}
                        level={recorder.level}
                        busyLabel={busyLabel}
                        notice={
                            recorder.failed
                                ? t("recordFailed")
                                : recorder.tooShort
                                  ? t("tooShort")
                                  : recorder.tooQuiet
                                    ? t("tooQuiet")
                                    : notice
                        }
                        reviewPlaying={!!recorder.uri && review.playingUri === recorder.uri}
                        onRecord={record}
                        onStop={recorder.stop}
                        onCancel={recorder.cancel}
                        onDelete={() => {
                            review.stop();
                            recorder.discard();
                        }}
                        onPlayRecording={() => {
                            voice.stop();
                            if (recorder.uri) review.play(recorder.uri);
                        }}
                        onStopPlayback={review.stop}
                        onSend={send}
                    />
                )}
            </View>
        </View>
    );
}

function CloseButton({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            style={styles.close}
            hitSlop={8}
        >
            <Ionicons name="close" size={28} color={colors.muted} />
        </Pressable>
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
    chat: { flexGrow: 1, gap: spacing.md, padding: spacing.lg },
    intro: { flexGrow: 1, padding: spacing.lg, paddingTop: 0 },
    error: { gap: spacing.sm, alignItems: "center" },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: colors.surface,
    },
});
