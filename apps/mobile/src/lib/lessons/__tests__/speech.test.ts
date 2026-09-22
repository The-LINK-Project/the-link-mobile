import { act, renderHook } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { useSpeech } from "../speech";

jest.mock("expo-speech", () => ({
    stop: jest.fn().mockResolvedValue(undefined),
    speak: jest.fn(),
    getAvailableVoicesAsync: jest.fn().mockResolvedValue([]),
}));
const stop = Speech.stop as jest.Mock;
const speak = Speech.speak as jest.Mock;
beforeEach(() => {
    jest.clearAllMocks();
    stop.mockResolvedValue(undefined);
});

test("old callbacks cannot stop a replacement utterance or unlock slow replay", async () => {
    const { result } = renderHook(useSpeech);
    await act(() => result.current.speak("tap out"));
    const old = speak.mock.calls[0][1];
    await act(() => result.current.speak("tap out"));
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
        pending = result.current.speak("tap out");
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
    await act(() => result.current.speak("tap out"));
    act(() => speak.mock.calls[0][1].onError());
    expect(result.current.hasPlayed).toBe(false);
    expect(result.current.speaking).toBe(false);
});
