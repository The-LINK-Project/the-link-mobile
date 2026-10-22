import { act, renderHook } from "@testing-library/react-native";
import type { AudioStatus } from "expo-audio";
import * as Speech from "expo-speech";

import { quietEveryone } from "@/lib/speaking/floor";
import { usePlayback } from "@/lib/speaking/playback";

import { recordingFor, useSpeech } from "../speech";

jest.mock("expo-speech", () => ({
    stop: jest.fn().mockResolvedValue(undefined),
    speak: jest.fn(),
    getAvailableVoicesAsync: jest.fn().mockResolvedValue([]),
}));

type MockPlayer = {
    replace: jest.Mock;
    setPlaybackRate: jest.Mock;
    play: jest.Mock;
    pause: jest.Mock;
    addListener: (
        event: string,
        listener: (status: Partial<AudioStatus>) => void,
    ) => {
        remove: () => void;
    };
    /** Sends the player's next status, as the native player would. */
    emit: (status: Partial<AudioStatus>) => void;
};

const mockPlayers: MockPlayer[] = [];
function mockCreatePlayer(): MockPlayer {
    const listeners = new Set<(status: Partial<AudioStatus>) => void>();
    const player: MockPlayer = {
        replace: jest.fn(),
        setPlaybackRate: jest.fn(),
        play: jest.fn(),
        pause: jest.fn(),
        addListener: (_event, listener) => {
            listeners.add(listener);
            return { remove: () => listeners.delete(listener) };
        },
        emit: (status) => listeners.forEach((listener) => listener(status)),
    };
    mockPlayers.push(player);
    return player;
}

const mockPlayerOptions: unknown[] = [];
jest.mock("expo-audio", () => {
    const { useState } = jest.requireActual<typeof import("react")>("react");
    return {
        setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
        useAudioPlayer: (_source: unknown, options: unknown) => {
            mockPlayerOptions.push(options);
            return useState(mockCreatePlayer)[0];
        },
        // For the tutor's player (lib/speaking/playback.ts) in the tests below.
        useAudioPlayerStatus: () => ({ playing: false }),
    };
});

// One word with a recording; everything else has none.
jest.mock("../audioClips", () => ({
    LESSON_CLIPS: {
        [jest.requireActual<typeof import("../audio")>("../audio").audioId("platform")]:
            "clip:platform",
    },
}));

const RECORDED = "platform";
const UNRECORDED = "tap out";

const stop = Speech.stop as jest.Mock;
const speak = Speech.speak as jest.Mock;
beforeEach(() => {
    jest.clearAllMocks();
    stop.mockResolvedValue(undefined);
    mockPlayers.length = 0;
    mockPlayerOptions.length = 0;
});

test("finds a text's recording by what it says", () => {
    expect(recordingFor(RECORDED)).toBe("clip:platform");
    expect(recordingFor(UNRECORDED)).toBeUndefined();
});

describe("a text with a recording", () => {
    test("plays in the tutor's voice, not the phone's", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(RECORDED));
        const [player] = mockPlayers;
        expect(player.replace).toHaveBeenCalledWith("clip:platform");
        expect(player.setPlaybackRate).toHaveBeenCalledWith(0.9, "high");
        expect(player.play).toHaveBeenCalledTimes(1);
        expect(speak).not.toHaveBeenCalled();
        expect(result.current.speaking).toBe(true);
    });

    test("is slowed less than the phone's voice for the slow replay", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(RECORDED, "slow"));
        expect(mockPlayers[0].setPlaybackRate).toHaveBeenCalledWith(0.7, "high");
    });

    test("unlocks the slow replay only once heard to the end at normal speed", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(RECORDED, "slow"));
        act(() => mockPlayers[0].emit({ didJustFinish: true }));
        expect(result.current.speaking).toBe(false);
        expect(result.current.hasPlayed).toBe(false);

        await act(() => result.current.speak(RECORDED));
        act(() => mockPlayers[0].emit({ playing: true, didJustFinish: false }));
        expect(result.current.hasPlayed).toBe(false);
        act(() => mockPlayers[0].emit({ didJustFinish: true }));
        expect(result.current.speaking).toBe(false);
        expect(result.current.hasPlayed).toBe(true);
    });

    test("restarts on a second tap rather than queueing", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(RECORDED));
        await act(() => result.current.speak(RECORDED));
        const [player] = mockPlayers;
        expect(player.pause).toHaveBeenCalled();
        expect(player.play).toHaveBeenCalledTimes(2);
        expect(result.current.speaking).toBe(true);
    });

    test("stops when asked, and a late end does not count as heard", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(RECORDED));
        act(() => result.current.stop());
        expect(mockPlayers[0].pause).toHaveBeenCalled();
        expect(result.current.speaking).toBe(false);
        act(() => mockPlayers[0].emit({ didJustFinish: true }));
        expect(result.current.hasPlayed).toBe(false);
    });

    test("is read by the phone's voice when the recording will not play", async () => {
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(RECORDED));
        await act(async () => mockPlayers[0].emit({ error: "Could not decode" }));
        expect(speak).toHaveBeenCalledWith(RECORDED, expect.objectContaining({ rate: 0.85 }));
        act(() => speak.mock.calls[0][1].onDone());
        expect(result.current.speaking).toBe(false);
        expect(result.current.hasPlayed).toBe(true);
    });

    test("silences a recording playing on another part of the screen", async () => {
        const first = renderHook(useSpeech);
        const second = renderHook(useSpeech);
        await act(() => first.result.current.speak(RECORDED));
        await act(() => second.result.current.speak(UNRECORDED));
        expect(mockPlayers[0].pause).toHaveBeenCalled();
        expect(first.result.current.speaking).toBe(false);
        expect(second.result.current.speaking).toBe(true);
        act(() => mockPlayers[0].emit({ didJustFinish: true }));
        expect(first.result.current.hasPlayed).toBe(false);
    });
});

describe("a text with no recording", () => {
    test("is read by the phone's voice", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(UNRECORDED));
        expect(speak).toHaveBeenCalledWith(UNRECORDED, expect.objectContaining({ rate: 0.85 }));
        expect(mockPlayers[0].play).not.toHaveBeenCalled();
    });

    test("old callbacks cannot stop a replacement utterance or unlock slow replay", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(UNRECORDED));
        const old = speak.mock.calls[0][1];
        await act(() => result.current.speak(UNRECORDED));
        act(() => {
            old.onStopped();
            old.onDone();
            old.onError();
        });
        expect(result.current.speaking).toBe(true);
        expect(result.current.hasPlayed).toBe(false);
        act(() => speak.mock.calls[1][1].onDone());
        expect(result.current.speaking).toBe(false);
        expect(result.current.hasPlayed).toBe(true);
    });

    test("stop cancels speech still waiting for the previous utterance to stop", async () => {
        let resolve!: () => void;
        stop.mockReturnValueOnce(
            new Promise<void>((done) => {
                resolve = done;
            }),
        );
        const { result } = renderHook(useSpeech);
        let pending!: Promise<void>;
        act(() => {
            pending = result.current.speak(UNRECORDED);
        });
        act(() => result.current.stop());
        await act(async () => {
            resolve();
            await pending;
        });
        expect(speak).not.toHaveBeenCalled();
        expect(result.current.speaking).toBe(false);
    });

    test("failed and interrupted speech does not count as a completed listen", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(UNRECORDED));
        act(() => speak.mock.calls[0][1].onError());
        expect(result.current.hasPlayed).toBe(false);
        expect(result.current.speaking).toBe(false);
    });
});

describe("lesson speech beside the rest of the app's audio", () => {
    test("keeps the iOS audio session up when a clip pauses or ends, so a recording is not cut off", () => {
        renderHook(useSpeech);
        expect(mockPlayerOptions).toContainEqual({ keepAudioSessionActive: true });
    });

    test("goes quiet before the microphone opens", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(RECORDED));
        expect(result.current.speaking).toBe(true);
        act(() => quietEveryone());
        expect(mockPlayers[0].pause).toHaveBeenCalled();
        expect(result.current.speaking).toBe(false);
    });

    test("goes quiet when the phone's voice is reading, too", async () => {
        const { result } = renderHook(useSpeech);
        await act(() => result.current.speak(UNRECORDED));
        stop.mockClear();
        act(() => quietEveryone());
        expect(stop).toHaveBeenCalled();
        expect(result.current.speaking).toBe(false);
    });

    test("never talks over the tutor, nor the tutor over it", async () => {
        const word = renderHook(useSpeech);
        const tutor = renderHook(usePlayback);
        const wordPlayer = mockPlayers[0];
        const tutorPlayer = mockPlayers[1];

        // A word held while the tutor is talking: the tutor stops.
        await act(async () => {
            await tutor.result.current.play("file:///reply.wav");
        });
        await act(() => word.result.current.speak(RECORDED));
        expect(tutorPlayer.pause).toHaveBeenCalled();
        expect(word.result.current.speaking).toBe(true);

        // The tutor's next line: the word stops.
        await act(async () => {
            await tutor.result.current.play("file:///next.wav");
        });
        expect(wordPlayer.pause).toHaveBeenCalled();
        expect(word.result.current.speaking).toBe(false);
    });
});
