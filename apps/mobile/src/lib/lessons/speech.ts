import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Normal is slightly under natural pace, because learners are hearing these
 * words for the first time. Slow inserts enough delay to separate words.
 */
const RATE = { normal: 0.85, slow: 0.45 } as const;

/** Prefer a local accent when available, then other installed English voices. */
const LANGUAGE_PREFERENCE = ["en-SG", "en-AU", "en-GB", "en-IN", "en-US"];

/** Used when no English voice can be enumerated at all. */
const FALLBACK_LANGUAGE = "en-US";

export type SpeechSpeed = keyof typeof RATE;

type ChosenVoice = { identifier?: string; language: string };

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
        };
    }, []);

    const speak = useCallback(async (text: string, speed: SpeechSpeed = "normal") => {
        if (!text.trim()) return;
        const request = ++generation.current;
        setSpeaking(true);
        const current = () => mounted.current && request === generation.current;
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
    }, []);

    const stop = useCallback(() => {
        ++generation.current;
        void Speech.stop().catch(() => undefined);
        setSpeaking(false);
    }, []);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (next) => {
            if (next !== "active") stop();
        });
        return () => subscription.remove();
    }, [stop]);

    return { speak, stop, speaking, hasPlayed };
}
