import { setAudioModeAsync, useAudioPlayer, type AudioSource, type AudioStatus } from "expo-audio";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { leaveTheFloor, takeTheFloor } from "@/lib/speaking/floor";

import { audioId } from "./audio";
import { LESSON_CLIPS } from "./audioClips";

/**
 * The phone's own voice. Normal is slightly under natural pace, because
 * learners are hearing these words for the first time. Slow inserts enough
 * delay to separate words.
 */
const RATE = { normal: 0.85, slow: 0.45 } as const;

/**
 * The same, for a recording, which is already spoken clearly for a learner.
 * Stretched further than this a recording starts to sound wrong.
 */
const RECORDING_RATE = { normal: 0.9, slow: 0.7 } as const;

/** Prefer a local accent when available, then other installed English voices. */
const LANGUAGE_PREFERENCE = ["en-SG", "en-AU", "en-GB", "en-IN", "en-US"];

/** Used when no English voice can be enumerated at all. */
const FALLBACK_LANGUAGE = "en-US";

export type SpeechSpeed = keyof typeof RATE;

type ChosenVoice = { identifier?: string; language: string };

/** The recording of a text in the tutor's voice (see audio.ts), or undefined when it has none yet. */
export function recordingFor(text: string): AudioSource | undefined {
    return LESSON_CLIPS[audioId(text)];
}

/**
 * Recordings play with the ringer switched off, as the tutor's voice does.
 *
 * Set once, as the app starts, and never again from here: after it the tutor's
 * player and the recorder always leave it on. On iOS a mode without
 * `allowsRecording` stops the microphone, and a held word can be read aloud on
 * the speaking screen while the learner is recording, so setting it on each tap
 * could cut their answer off.
 */
const playbackReady = Promise.resolve()
    .then(() => setAudioModeAsync({ playsInSilentMode: true }))
    .catch((error: unknown) => {
        if (__DEV__) console.warn("Could not set the audio mode", error);
    });

/** Prefer enhanced voices, then accent. */
async function pickVoice(): Promise<ChosenVoice> {
    try {
        const voices = await Speech.getAvailableVoicesAsync();
        const english = voices.filter((voice) => voice.language?.startsWith("en"));
        if (english.length === 0) return { language: FALLBACK_LANGUAGE };

        const score = (voice: Speech.Voice) => {
            const accent = LANGUAGE_PREFERENCE.indexOf(voice.language);
            return {
                // Quality dominates: a good US voice beats a compact British one.
                quality: voice.quality === Speech.VoiceQuality.Enhanced ? 0 : 1,
                accent: accent === -1 ? LANGUAGE_PREFERENCE.length : accent,
            };
        };

        const best = english.reduce((a, b) => {
            const left = score(a);
            const right = score(b);
            if (left.quality !== right.quality) return left.quality < right.quality ? a : b;
            return left.accent <= right.accent ? a : b;
        });

        return { identifier: best.identifier, language: best.language };
    } catch {
        // Voice enumeration is not critical; speaking without it still works.
        return { language: FALLBACK_LANGUAGE };
    }
}

/**
 * Speak English aloud: the recording in the tutor's voice when there is one
 * (see `audio.ts`), and the phone's own voice otherwise, or when a recording
 * will not play.
 */
export function useSpeech() {
    const [speaking, setSpeaking] = useState(false);
    /**
     * The slow replay button only appears once the phrase has been heard at
     * normal speed, so the first thing a learner hears is natural pace.
     */
    const [hasPlayed, setHasPlayed] = useState(false);
    const mounted = useRef(true);
    const generation = useRef(0);
    /** Resolved once per mount; playback works with or without it. */
    const voice = useRef<ChosenVoice>({ language: FALLBACK_LANGUAGE });
    // Kept active on iOS when the clip pauses or ends: deactivating it there
    // stops a recording in progress, and a held word can be read aloud on the
    // speaking screen while the microphone is open.
    const player = useAudioPlayer(null, { keepAudioSessionActive: true });
    /** The recording playing, if any: which request it belongs to, and what it says. */
    const clip = useRef<{ request: number; text: string; speed: SpeechSpeed } | null>(null);

    useEffect(() => {
        mounted.current = true;
        const requests = generation;
        void pickVoice().then((chosen) => {
            if (mounted.current) voice.current = chosen;
        });
        return () => {
            mounted.current = false;
            ++requests.current;
            void Speech.stop().catch(() => undefined);
            // The player is released with the screen, which ends a recording too.
        };
    }, []);

    const speakWithVoice = useCallback(
        async (text: string, speed: SpeechSpeed, current: () => boolean) => {
            const finish = () => {
                if (current()) setSpeaking(false);
            };
            try {
                await Speech.stop();
                if (!current()) return;
                Speech.speak(text, {
                    language: voice.current.language,
                    voice: voice.current.identifier,
                    rate: RATE[speed],
                    onDone: () => {
                        if (!current()) return;
                        setSpeaking(false);
                        if (speed === "normal") setHasPlayed(true);
                    },
                    onStopped: finish,
                    onError: finish,
                });
            } catch {
                finish();
            }
        },
        [],
    );

    const pauseClip = useCallback(() => {
        clip.current = null;
        try {
            player.pause();
        } catch {
            // Already released with its screen: there is nothing to pause.
        }
    }, [player]);

    const stop = useCallback(() => {
        ++generation.current;
        pauseClip();
        void Speech.stop().catch(() => undefined);
        setSpeaking(false);
    }, [pauseClip]);

    useEffect(() => () => leaveTheFloor(stop), [stop]);

    useEffect(() => {
        const subscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
            const playing = clip.current;
            if (!playing || !mounted.current || playing.request !== generation.current) return;
            if (status.didJustFinish) {
                clip.current = null;
                setSpeaking(false);
                if (playing.speed === "normal") setHasPlayed(true);
            } else if (status.error) {
                // A recording that will not load or play is read by the phone instead.
                if (__DEV__) console.warn("Could not play the recording", status.error);
                clip.current = null;
                const current = () => mounted.current && playing.request === generation.current;
                void speakWithVoice(playing.text, playing.speed, current);
            }
        });
        return () => subscription.remove();
    }, [player, speakWithVoice]);

    const speak = useCallback(
        async (text: string, speed: SpeechSpeed = "normal") => {
            if (!text.trim()) return;
            // Whoever else was talking stops, the tutor included (see
            // speaking/floor.ts); a second tap here restarts rather than queues.
            takeTheFloor(stop);
            const request = ++generation.current;
            const current = () => mounted.current && request === generation.current;
            pauseClip();
            setSpeaking(true);

            const source = recordingFor(text);
            if (source !== undefined) {
                await playbackReady;
                if (!current()) return;
                if (AppState.currentState === "background") {
                    setSpeaking(false);
                    return;
                }
                try {
                    // The phone's voice from an earlier tap, still talking.
                    void Speech.stop().catch(() => undefined);
                    clip.current = { request, text, speed };
                    player.replace(source);
                    player.setPlaybackRate(RECORDING_RATE[speed], "high");
                    player.play();
                    return;
                } catch (error) {
                    if (__DEV__) console.warn("Could not play the recording", error);
                    clip.current = null;
                    if (!current()) return;
                }
            }
            await speakWithVoice(text, speed, current);
        },
        [pauseClip, player, speakWithVoice, stop],
    );

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (next) => {
            if (next !== "active") stop();
        });
        return () => subscription.remove();
    }, [stop]);

    return { speak, stop, speaking, hasPlayed };
}
