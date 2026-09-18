import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { useRecorder } from "../recorder";

let mockStatusListener: (event: { hasError: boolean }) => void;
const mockPermission = jest.fn();
const mockMode = jest.fn();
const mockDelete = jest.fn();
const mockRecorder = {
    uri: "file:///recording.wav",
    prepareToRecordAsync: jest.fn(),
    record: jest.fn(),
    stop: jest.fn(),
    getStatus: jest.fn(() => ({ durationMillis: 1500 })),
};
jest.mock("expo-audio", () => ({
    AudioQuality: { HIGH: 96 },
    IOSOutputFormat: { LINEARPCM: "lpcm" },
    requestRecordingPermissionsAsync: () => mockPermission(),
    setAudioModeAsync: (mode: unknown) => mockMode(mode),
    useAudioRecorder: (_options: unknown, listener: typeof mockStatusListener) => {
        mockStatusListener = listener;
        return mockRecorder;
    },
    useAudioRecorderState: () => mockLive,
}));
/** What the native recorder reports while recording; tests set the level. */
let mockLive: { durationMillis: number; metering?: number } = { durationMillis: 0 };
jest.mock("../files", () => ({ deleteFile: (uri: unknown) => mockDelete(uri) }));
jest.mock("expo-file-system", () => ({
    File: class {
        base64 = async () => "AQIDBA==";
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockLive = { durationMillis: 0 };
    AppState.currentState = "active";
    mockPermission.mockResolvedValue({ granted: true });
    mockMode.mockResolvedValue(undefined);
    mockRecorder.prepareToRecordAsync.mockResolvedValue(undefined);
    mockRecorder.stop.mockResolvedValue(undefined);
});

test("leaving while permission is pending never starts the microphone", async () => {
    let resolve!: (value: { granted: boolean }) => void;
    mockPermission.mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const hook = renderHook(useRecorder);
    let pending!: ReturnType<typeof hook.result.current.start>;
    act(() => {
        pending = hook.result.current.start();
    });
    hook.unmount();
    await act(async () => {
        resolve({ granted: true });
        await pending;
    });
    expect(mockRecorder.record).not.toHaveBeenCalled();
    expect(mockMode).not.toHaveBeenCalled();
});

test("leaving during prepare closes and removes the prepared file", async () => {
    let resolve!: () => void;
    mockRecorder.prepareToRecordAsync.mockReturnValueOnce(
        new Promise<void>((done) => {
            resolve = done;
        }),
    );
    const hook = renderHook(useRecorder);
    let pending!: ReturnType<typeof hook.result.current.start>;
    await act(async () => {
        pending = hook.result.current.start();
    });
    hook.unmount();
    await act(async () => {
        resolve();
        await pending;
    });
    expect(mockRecorder.record).not.toHaveBeenCalled();
    expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(mockRecorder.uri);
    expect(mockMode).toHaveBeenLastCalledWith({ allowsRecording: false, playsInSilentMode: true });
});

test("failed preparation restores playback mode", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockRecorder.prepareToRecordAsync.mockRejectedValueOnce(new Error("busy"));
    const { result } = renderHook(useRecorder);
    await act(async () => {
        expect(await result.current.start()).toBe("failed");
    });
    expect(result.current.status).toBe("idle");
    expect(mockMode).toHaveBeenLastCalledWith({ allowsRecording: false, playsInSilentMode: true });
    jest.restoreAllMocks();
});

test("duplicate starts do not replace the active recording", async () => {
    const { result } = renderHook(useRecorder);
    await act(() => result.current.start());
    await act(async () => {
        expect(await result.current.start()).toBe("failed");
    });
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
    await act(() => result.current.stop());
    expect(result.current.status).toBe("recorded");
    expect(await result.current.read()).toEqual({ mimeType: "audio/wav", data: "AQIDBA==" });
    act(() => result.current.discard());
    expect(await result.current.read()).toBeNull();
});

test("backgrounding finalizes a recording for review", async () => {
    let onChange!: (state: AppStateStatus) => void;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
        onChange = listener;
        return { remove: jest.fn() };
    });
    const { result } = renderHook(useRecorder);
    await act(() => result.current.start());
    await act(async () => {
        onChange("background");
    });
    expect(result.current.status).toBe("recorded");
    expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
});

test("permission activity backgrounding does not cancel an approved recording", async () => {
    let onChange!: (state: AppStateStatus) => void;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
        onChange = listener;
        return { remove: jest.fn() };
    });
    mockPermission.mockImplementationOnce(async () => {
        onChange("background");
        onChange("active");
        return { granted: true };
    });
    const { result } = renderHook(useRecorder);
    await act(async () => {
        expect(await result.current.start()).toBe("started");
    });
    expect(result.current.status).toBe("recording");
    await act(() => result.current.cancel());
    jest.restoreAllMocks();
});

test("a native stop error cannot expose a broken recording for upload", async () => {
    const { result } = renderHook(useRecorder);
    await act(() => result.current.start());
    mockRecorder.stop.mockImplementationOnce(async () => {
        mockStatusListener({ hasError: true });
    });
    await act(() => result.current.stop());
    expect(result.current.status).toBe("idle");
    expect(result.current.failed).toBe(true);
    expect(await result.current.read()).toBeNull();
});

test("a recording that never rose above silence is thrown away, not sent", async () => {
    // Regression: a silent clip sent to the tutor came back as invented words.
    mockLive = { durationMillis: 0, metering: -70 };
    const hook = renderHook(useRecorder);
    await act(async () => {
        await hook.result.current.start();
    });
    hook.rerender(undefined);
    await act(async () => {
        await hook.result.current.stop();
    });
    expect(hook.result.current.status).toBe("idle");
    expect(hook.result.current.tooQuiet).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith("file:///recording.wav");
});

test("a recording with speech in it is kept, and one with no level reading is trusted", async () => {
    mockLive = { durationMillis: 0, metering: -20 };
    const spoken = renderHook(useRecorder);
    await act(async () => {
        await spoken.result.current.start();
    });
    spoken.rerender(undefined);
    await act(async () => {
        await spoken.result.current.stop();
    });
    expect(spoken.result.current.status).toBe("recorded");
    expect(spoken.result.current.tooQuiet).toBe(false);

    // A platform that reports no level at all must not block every recording.
    mockLive = { durationMillis: 0 };
    const unmetered = renderHook(useRecorder);
    await act(async () => {
        await unmetered.result.current.start();
    });
    await act(async () => {
        await unmetered.result.current.stop();
    });
    expect(unmetered.result.current.status).toBe("recorded");
});
