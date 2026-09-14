import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useState } from "react";

/** Natural pace, and a slower replay for words heard for the first time. */
const RATE = { normal: 1, slow: 0.75 } as const;

export type PlaybackSpeed = keyof typeof RATE;

/** Plays one local file at a time. Starting another replaces it, and stop always works. */
export function usePlayback() {
    const player = useAudioPlayer(null);
    const status = useAudioPlayerStatus(player);
    const [current, setCurrent] = useState<string | null>(null);

    const play = useCallback(
        (uri: string, speed: PlaybackSpeed = "normal") => {
            player.replace({ uri });
            player.play();
            player.setPlaybackRate(RATE[speed], "high");
            setCurrent(uri);
        },
        [player],
    );

    const stop = useCallback(() => {
        player.pause();
        setCurrent(null);
    }, [player]);

    return { play, stop, playingUri: status.playing ? current : null };
}
