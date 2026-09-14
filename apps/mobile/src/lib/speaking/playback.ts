import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

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

    useEffect(() => {
        if (status.playing) soundAt.current = Date.now();
    }, [status.playing, status.currentTime]);

    const play = useCallback(
        (uri: string, speed: PlaybackSpeed = "normal") => {
            soundAt.current = Date.now();
            player.replace({ uri });
            player.play();
            player.setPlaybackRate(RATE[speed], "high");
            setCurrent(uri);
        },
        [player],
    );

    const stop = useCallback(() => {
        if (player.playing) soundAt.current = Date.now();
        player.pause();
        setCurrent(null);
    }, [player]);

    /** Milliseconds since this player last made sound. */
    const quietForMs = useCallback(() => Date.now() - soundAt.current, []);

    return { play, stop, quietForMs, playingUri: status.playing ? current : null };
}
