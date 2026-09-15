import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/** Natural pace, and a slower replay for words heard for the first time. */
const RATE = { normal: 1, slow: 0.75 } as const;

export type PlaybackSpeed = keyof typeof RATE;

/** Plays one local file at a time. Starting another replaces it, and stop always works. */
export function usePlayback() {
    const player = useAudioPlayer(null);
    const status = useAudioPlayerStatus(player);
    const [current, setCurrent] = useState<string | null>(null);
    /** When this player last made sound. */
    const soundAt = useRef(0);
    const generation = useRef(0);
    const mounted = useRef(true);

    useEffect(() => {
        if (status.playing) soundAt.current = Date.now();
    }, [status.playing, status.currentTime]);

    const play = useCallback(
        async (uri: string, speed: PlaybackSpeed = "normal") => {
            const request = ++generation.current;
            try {
                await setAudioModeAsync({ playsInSilentMode: true });
                if (
                    !mounted.current ||
                    request !== generation.current ||
                    AppState.currentState === "background"
                )
                    return;
                soundAt.current = Date.now();
                player.replace({ uri });
                player.setPlaybackRate(RATE[speed], "high");
                player.play();
                setCurrent(uri);
            } catch (error) {
                if (__DEV__) console.warn("Could not play audio", error);
                if (mounted.current && request === generation.current) setCurrent(null);
            }
        },
        [player],
    );

    const stop = useCallback(() => {
        ++generation.current;
        if (player.playing) soundAt.current = Date.now();
        player.pause();
        setCurrent(null);
    }, [player]);

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
        };
    }, [stop]);

    /** Milliseconds since this player last made sound. */
    const quietForMs = useCallback(() => Date.now() - soundAt.current, []);

    return { play, stop, quietForMs, playingUri: status.playing ? current : null };
}
