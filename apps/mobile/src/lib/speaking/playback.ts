import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { leaveTheFloor, takeTheFloor } from "./floor";

/** Natural pace, and a slower replay for words heard for the first time. */
const RATE = { normal: 1, slow: 0.75 } as const;

export type PlaybackSpeed = keyof typeof RATE;

/**
 * Plays one local file at a time. Starting another replaces it, and stop always
 * works. Starting one also quiets any other voice in the app (see floor.ts).
 */
export function usePlayback() {
    // Kept active on iOS when playback pauses or ends: deactivating it there,
    // 100 ms later, can land on a recording the learner has just started.
    const player = useAudioPlayer(null, { keepAudioSessionActive: true });
    const status = useAudioPlayerStatus(player);
    const [current, setCurrent] = useState<string | null>(null);
    /** When this player last made sound. */
    const soundAt = useRef(0);
    const generation = useRef(0);
    const mounted = useRef(true);

    useEffect(() => {
        if (status.playing) soundAt.current = Date.now();
    }, [status.playing, status.currentTime]);

    const stop = useCallback(() => {
        ++generation.current;
        try {
            if (player.playing) soundAt.current = Date.now();
            player.pause();
        } catch {
            // Already released with its screen: there is nothing to pause.
        }
        setCurrent(null);
    }, [player]);

    /**
     * Resolves true once the file has started, and false when it did not: a
     * later request or a stop took over, the app went to the background, or the
     * file would not play.
     */
    const play = useCallback(
        async (uri: string, speed: PlaybackSpeed = "normal"): Promise<boolean> => {
            const request = ++generation.current;
            takeTheFloor(stop);
            try {
                await setAudioModeAsync({ playsInSilentMode: true });
                if (
                    !mounted.current ||
                    request !== generation.current ||
                    AppState.currentState === "background"
                )
                    return false;
                soundAt.current = Date.now();
                player.replace({ uri });
                player.setPlaybackRate(RATE[speed], "high");
                player.play();
                setCurrent(uri);
                return true;
            } catch (error) {
                if (__DEV__) console.warn("Could not play audio", error);
                if (mounted.current && request === generation.current) setCurrent(null);
                return false;
            }
        },
        [player, stop],
    );

    useEffect(() => {
        mounted.current = true;
        const requests = generation;
        const subscription = AppState.addEventListener("change", (next) => {
            if (next !== "active") stop();
        });
        return () => {
            mounted.current = false;
            ++requests.current;
            subscription.remove();
            leaveTheFloor(stop);
        };
    }, [stop]);

    /** Milliseconds since this player last made sound. */
    const quietForMs = useCallback(() => Date.now() - soundAt.current, []);

    return { play, stop, quietForMs, playingUri: status.playing ? current : null };
}
