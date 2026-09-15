import { act, renderHook } from "@testing-library/react-native";
import { usePlayback } from "../playback";
const mockMode = jest.fn();
const mockPlayer = {
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    setPlaybackRate: jest.fn(),
};
jest.mock("expo-audio", () => ({
    setAudioModeAsync: () => mockMode(),
    useAudioPlayer: () => mockPlayer,
    useAudioPlayerStatus: () => ({ playing: false }),
}));
beforeEach(() => {
    jest.clearAllMocks();
    mockMode.mockResolvedValue(undefined);
});

test("stop cancels playback queued behind audio-mode setup", async () => {
    let resolve!: () => void;
    mockMode.mockReturnValueOnce(
        new Promise<void>((done) => {
            resolve = done;
        }),
    );
    const { result } = renderHook(usePlayback);
    let pending!: Promise<void>;
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
    let pending!: Promise<void>;
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
