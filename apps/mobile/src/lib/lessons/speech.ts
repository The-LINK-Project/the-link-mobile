/**
 * Text-to-speech for listening exercises.
 *
 * Wraps `expo-speech` behind one interface so the audio source can change
 * without touching any exercise. When recorded human audio or a generated
 * voice service arrives, `speak` is the only function that has to change.
 *
 * Deliberately not copying Duolingo here: their listening audio autoplays and
 * cannot be stopped, which an accessibility audit flags as a WCAG failure.
 * Playback here is always learner-initiated and always interruptible.
 */

import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Normal is slightly under natural pace, because learners are hearing these
 * words for the first time. Slow inserts enough delay to separate words.
 */
const RATE = { normal: 0.85, slow: 0.45 } as const;

/**
 * Accent preference, best first.
 *
 * Singapore English is what a learner will actually hear at a station, but no
 * platform ships an `en-SG` voice, so it is listed first in case one ever
 * appears and the rest are fallbacks. This ordering is a guess about which
 * accents sit closest to local speech and is worth revisiting with real
 * learners rather than treating as settled.
 */
const LANGUAGE_PREFERENCE = ["en-SG", "en-AU", "en-GB", "en-IN", "en-US"];

/** Used when no English voice can be enumerated at all. */
const FALLBACK_LANGUAGE = "en-US";

export type SpeechSpeed = keyof typeof RATE;

type ChosenVoice = { identifier?: string; language: string };

/**
 * Pick the best English voice installed on this device.
 *
 * Apple and Android both ship a low-quality compact voice by default and offer
 * better ones as a separate download, so the same code sounds noticeably
 * different depending on what the owner has installed. Preferring `Enhanced`
 * uses the good voice whenever it is present. It cannot conjure one: on the
 * iOS Simulator only the compact voice exists, which is why audio there stays
 * robotic no matter what this function does.
 */
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
    /** Resolved once per mount; playback works with or without it. */
    const voice = useRef<ChosenVoice>({ language: FALLBACK_LANGUAGE });

    useEffect(() => {
        mounted.current = true;
        void pickVoice().then((chosen) => {
            if (mounted.current) voice.current = chosen;
        });
        return () => {
            mounted.current = false;
            void Speech.stop();
        };
    }, []);

    const speak = useCallback((text: string, speed: SpeechSpeed = "normal") => {
        if (!text.trim()) return;
        // Restart rather than queue, so repeated taps do not stack up playbacks.
        void Speech.stop();
        setSpeaking(true);
        const finish = () => {
            if (!mounted.current) return;
            setSpeaking(false);
            setHasPlayed(true);
        };
        Speech.speak(text, {
            language: voice.current.language,
            voice: voice.current.identifier,
            rate: RATE[speed],
            onDone: finish,
            onStopped: finish,
            // A device with no voice installed must not leave the button spinning.
            onError: finish,
        });
    }, []);

    const stop = useCallback(() => {
        void Speech.stop();
        setSpeaking(false);
    }, []);

    return { speak, stop, speaking, hasPlayed };
}
