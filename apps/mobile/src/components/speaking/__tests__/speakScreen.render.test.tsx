/**
 * Screen-level tests for speaking practice.
 *
 * The recorder, the player and the API are faked. What is under test is the join
 * between them: nothing is sent without a tap, a cancelled or deleted recording
 * is removed from the phone, and a failed send keeps the recording so it can be
 * sent again.
 */

import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import SpeakScreen from "@/app/(app)/speak/[id]";
import { api, ApiError, type TutorTurnRequest } from "@/lib/api";
import { setLocale } from "@/lib/i18n";

const RECORDING = "file:///cache/recording.wav";
const mockFiles = new Set<string>();
const mockDeleted: string[] = [];
const mockPlayer = {
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    setPlaybackRate: jest.fn(),
};

jest.mock("expo-router", () => ({
    useLocalSearchParams: () => ({ id: "mrt-basics" }),
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
    Stack: { Screen: () => null },
}));

jest.mock("expo-audio", () => {
    const recorder = {
        uri: "file:///cache/recording.wav",
        prepareToRecordAsync: async () => undefined,
        record: () => mockFiles.add("file:///cache/recording.wav"),
        stop: async () => undefined,
        getStatus: () => ({ durationMillis: 2500 }),
    };
    return {
        AudioQuality: { HIGH: 96 },
        IOSOutputFormat: { LINEARPCM: "lpcm" },
        requestRecordingPermissionsAsync: async () => ({ granted: true }),
        setAudioModeAsync: async () => undefined,
        useAudioRecorder: () => recorder,
        useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0, metering: -20 }),
        useAudioPlayer: () => mockPlayer,
        useAudioPlayerStatus: () => ({ playing: false, didJustFinish: false }),
    };
});

jest.mock("expo-file-system", () => ({
    Paths: { cache: "file:///cache" },
    File: class {
        uri: string;
        constructor(...parts: string[]) {
            this.uri = parts.join("/");
        }
        get exists() {
            return mockFiles.has(this.uri);
        }
        create() {
            mockFiles.add(this.uri);
        }
        write() {}
        async base64() {
            return "UklGRg==";
        }
        delete() {
            mockFiles.delete(this.uri);
            mockDeleted.push(this.uri);
        }
    },
}));

jest.mock("@/lib/api", () => {
    class ApiError extends Error {
        status: number;
        constructor(status: number, message: string) {
            super(message);
            this.status = status;
        }
    }
    return { ApiError, api: { tutorTurn: jest.fn() } };
});

const tutorTurn = api.tutorTurn as jest.Mock;

const OPENING = {
    heard: "",
    reply: "স্বাগতম! স্টাফকে প্ল্যাটফর্ম কোনটি জিজ্ঞাসা করুন।",
    outcome: "opening",
    finished: false,
    audio: { mimeType: "audio/wav", data: "UklGRg==" },
};

function answer(outcome: string, heard = "Which platform for Jurong East?") {
    return { heard, reply: "খুব ভালো!", outcome, finished: false, audio: null };
}

function withScreenReader(enabled: boolean) {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(enabled);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({
        remove: jest.fn(),
    } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>);
}

/** Opens the screen in Bengali and waits for the tutor's first line. */
async function startConversation() {
    const user = userEvent.setup();
    render(<SpeakScreen />);
    await user.press(await screen.findByText("Start"));
    await screen.findByText(OPENING.reply);
    return user;
}

async function recordAndStop(user: ReturnType<typeof userEvent.setup>) {
    await user.press(screen.getByLabelText("Start recording"));
    await user.press(await screen.findByLabelText("Stop recording"));
}

beforeEach(async () => {
    jest.clearAllMocks();
    tutorTurn.mockReset();
    mockFiles.clear();
    mockDeleted.length = 0;
    await act(() => setLocale("bn"));
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("speaking practice", () => {
    it("asks which language the learner speaks before the tutor opens in it", async () => {
        await act(() => setLocale("en"));
        withScreenReader(false);
        tutorTurn.mockResolvedValueOnce(OPENING);
        const user = userEvent.setup();
        render(<SpeakScreen />);

        // English is not a language the tutor teaches from, so nothing is chosen yet.
        expect((await screen.findByLabelText("Start")).props.accessibilityState?.disabled).toBe(
            true,
        );
        await user.press(screen.getByText("தமிழ்"));
        await user.press(screen.getByText("Start"));

        await screen.findByText(OPENING.reply);
        const turn = tutorTurn.mock.calls[0][0] as TutorTurnRequest;
        expect(turn.language).toBe("ta");
        expect(turn.audio).toBeUndefined();
        expect(turn.goals.map((goal) => goal.target)).toContain("Which platform for Jurong East?");
        // The tutor's first line plays by itself.
        expect(mockPlayer.play).toHaveBeenCalled();
    });

    it("sends nothing until Send, and lets the learner delete a recording first", async () => {
        withScreenReader(false);
        tutorTurn.mockResolvedValueOnce(OPENING).mockResolvedValueOnce(answer("met"));
        const user = await startConversation();

        await recordAndStop(user);
        await user.press(await screen.findByLabelText("Delete recording"));
        expect(mockDeleted).toEqual([RECORDING]);
        expect(await screen.findByLabelText("Start recording")).toBeTruthy();
        expect(tutorTurn).toHaveBeenCalledTimes(1);

        await recordAndStop(user);
        await user.press(await screen.findByLabelText("Send"));

        await screen.findByText("Which platform for Jurong East?");
        const turn = tutorTurn.mock.calls[1][0] as TutorTurnRequest;
        expect(turn.audio).toEqual({ mimeType: "audio/wav", data: "UklGRg==" });
        expect(turn.history).toEqual([{ role: "tutor", text: OPENING.reply }]);
        // Sent, so gone from the phone.
        await waitFor(() => expect(mockDeleted).toEqual([RECORDING, RECORDING]));
    });

    it("throws away a recording cancelled while it runs", async () => {
        withScreenReader(false);
        tutorTurn.mockResolvedValueOnce(OPENING);
        const user = await startConversation();

        await user.press(screen.getByLabelText("Start recording"));
        await user.press(await screen.findByLabelText("Cancel recording"));

        expect(await screen.findByLabelText("Start recording")).toBeTruthy();
        expect(mockDeleted).toEqual([RECORDING]);
        expect(tutorTurn).toHaveBeenCalledTimes(1);
    });

    it("keeps the recording after a failed send so it can be sent again", async () => {
        withScreenReader(false);
        tutorTurn
            .mockResolvedValueOnce(OPENING)
            .mockRejectedValueOnce(new ApiError(0, "Network error"))
            .mockResolvedValueOnce(answer("retry", ""));
        const user = await startConversation();

        await recordAndStop(user);
        await user.press(await screen.findByLabelText("Send"));
        await screen.findByText("The tutor could not answer. Check your connection and try again.");
        expect(mockDeleted).toEqual([]);

        await user.press(screen.getByLabelText("Send"));
        // The tutor could not make this one out, and the screen says so.
        await screen.findByText("Voice message (not clear)");
        expect(tutorTurn).toHaveBeenCalledTimes(3);
    });

    it("leaves the tutor's voice to the learner under a screen reader", async () => {
        withScreenReader(true);
        tutorTurn.mockResolvedValueOnce(OPENING);
        await startConversation();

        expect(mockPlayer.play).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Listen")).toBeTruthy();
    });
});
