import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import { quietEveryone } from "../floor";
import { usePlayback } from "../playback";
const mockMode = jest.fn();
const mockUseAudioPlayer = jest.fn();
const mockPlayer = {
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    setPlaybackRate: jest.fn(),
};
jest.mock("expo-audio", () => ({
    setAudioModeAsync: () => mockMode(),
    useAudioPlayer: (...args: unknown[]) => {
        mockUseAudioPlayer(...args);
        return mockPlayer;
    },
    useAudioPlayerStatus: () => ({ playing: false }),
}));
beforeEach(() => {
    jest.clearAllMocks();
    mockMode.mockResolvedValue(undefined);
    AppState.currentState = "active";
});

test("stop cancels playback queued behind audio-mode setup", async () => {
    let resolve!: () => void;
    mockMode.mockReturnValueOnce(
        new Promise<void>((done) => {
            resolve = done;
        }),
    );
    const { result } = renderHook(usePlayback);
    let pending!: Promise<boolean>;
    act(() => {
        pending = result.current.play("file:///old.wav");
    });
    act(() => result.current.stop());
    await act(async () => {
        resolve();
        await pending;
    });
    expect(mockPlayer.play).not.toHaveBeenCalled();
});

test("only the latest playback request starts, at its requested rate", async () => {
    let resolve!: () => void;
    mockMode.mockReturnValueOnce(
        new Promise<void>((done) => {
            resolve = done;
        }),
    );
    const { result } = renderHook(usePlayback);
    let pending!: Promise<boolean>;
    act(() => {
        pending = result.current.play("file:///old.wav");
    });
    await act(() => result.current.play("file:///new.wav", "slow"));
    await act(async () => {
        resolve();
        await pending;
    });
    expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
    expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: "file:///new.wav" });
    expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(0.75, "high");
});

test("keeps the iOS audio session up when playback pauses or ends, so a recording is not cut off", () => {
    renderHook(usePlayback);
    expect(mockUseAudioPlayer).toHaveBeenCalledWith(null, { keepAudioSessionActive: true });
});

test("says whether the file started", async () => {
    const { result } = renderHook(usePlayback);
    let started: boolean | undefined;
    await act(async () => {
        started = await result.current.play("file:///one.wav");
    });
    expect(started).toBe(true);

    // Superseded while the audio mode was being set.
    let resolve!: () => void;
    mockMode.mockReturnValueOnce(
        new Promise<void>((done) => {
            resolve = done;
        }),
    );
    let pending!: Promise<boolean>;
    act(() => {
        pending = result.current.play("file:///two.wav");
    });
    act(() => result.current.stop());
    await act(async () => {
        resolve();
        started = await pending;
    });
    expect(started).toBe(false);
});

test("does not start in the background, and says so", async () => {
    AppState.currentState = "background";
    const { result } = renderHook(usePlayback);
    let started: boolean | undefined;
    await act(async () => {
        started = await result.current.play("file:///reply.wav");
    });
    expect(started).toBe(false);
    expect(mockPlayer.play).not.toHaveBeenCalled();
});

describe("one voice at a time", () => {
    test("a second player starting quiets the first", async () => {
        const tutor = renderHook(usePlayback);
        const own = renderHook(usePlayback);
        await act(() => tutor.result.current.play("file:///reply.wav"));
        mockPlayer.pause.mockClear();
        await act(() => own.result.current.play("file:///recording.wav"));
        // The first player's stop ran: it paused before the second started.
        expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    });

    test("quieting everyone stops the voice playing", async () => {
        const { result } = renderHook(usePlayback);
        await act(() => result.current.play("file:///reply.wav"));
        act(() => quietEveryone());
        expect(mockPlayer.pause).toHaveBeenCalled();
    });

    test("a player whose screen has closed is not called on again", async () => {
        const view = renderHook(usePlayback);
        await act(() => view.result.current.play("file:///reply.wav"));
        view.unmount();
        mockPlayer.pause.mockClear();
        act(() => quietEveryone());
        expect(mockPlayer.pause).not.toHaveBeenCalled();
    });
});
