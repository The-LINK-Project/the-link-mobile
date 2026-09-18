/**
 * Screen-level tests for speaking practice.
 *
 * The recorder, the player and the API are faked. What is under test is the join
 * between them: nothing is sent without a tap, a cancelled or deleted recording
 * is removed from the phone, and a failed send keeps the recording so it can be
 * sent again.
 */

import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, AppState } from "react-native";

import SpeakScreen from "@/app/(app)/speak/[id]";
import { api, ApiError, type TutorTurnRequest } from "@/lib/api";
import { FIRST_LANGUAGE_LABELS } from "@/lib/firstLanguage/languages";
import { resetFirstLanguageForTests, setFirstLanguage } from "@/lib/firstLanguage/store";
import i18n, { setLocale } from "@/lib/i18n";

/** A speaking-practice string in whatever language the screen is showing. */
const label = (key: string) => i18n.t(`mobile.speaking.${key}`);

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
    await user.press(await screen.findByText(label("start")));
    await screen.findByText(OPENING.reply);
    return user;
}

async function recordAndStop(user: ReturnType<typeof userEvent.setup>) {
    await user.press(screen.getByLabelText(label("record")));
    await user.press(await screen.findByLabelText(label("stop")));
}

beforeEach(async () => {
    AppState.currentState = "active";
    jest.clearAllMocks();
    tutorTurn.mockReset();
    mockFiles.clear();
    mockDeleted.length = 0;
    resetFirstLanguageForTests();
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
        await user.press(screen.getByText("Choose your language first"));
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

    it("opens in the language the learner named as their own", async () => {
        // The app is in English, but this learner told us they read Tamil.
        await act(() => setLocale("en"));
        await act(() => setFirstLanguage("ta"));
        withScreenReader(false);
        tutorTurn.mockResolvedValueOnce(OPENING);
        const user = userEvent.setup();
        render(<SpeakScreen />);

        expect(await screen.findByText("பேசிப் பயிற்சி")).toBeTruthy();
        expect(
            screen.getByText(
                "ஆசிரியர் உங்களைக் கேட்க, உங்கள் குரல் Google-இன் Gemini AI-க்கு அனுப்பப்படும். தி லிங்க் ப்ராஜெக்ட் உங்கள் பதிவுகளை வைத்திருக்காது.",
            ),
        ).toBeTruthy();
        await user.press(await screen.findByText("தொடங்கு"));
        await screen.findByText(OPENING.reply);
        expect((tutorTurn.mock.calls[0][0] as TutorTurnRequest).language).toBe("ta");
    });

    it("opens in any onboarding language the learner chose", async () => {
        await act(() => setFirstLanguage("th"));
        withScreenReader(false);
        tutorTurn.mockResolvedValueOnce(OPENING);
        const user = userEvent.setup();
        render(<SpeakScreen />);
        expect(await screen.findByText("ฝึกพูด")).toBeTruthy();
        expect(
            screen.getByText(
                "เสียงของคุณจะถูกส่งไปยัง Gemini AI ของ Google เพื่อให้ผู้สอนได้ยินคุณ The LINK Project จะไม่เก็บเสียงบันทึกของคุณ",
            ),
        ).toBeTruthy();
        await user.press(await screen.findByText("เริ่ม"));
        await screen.findByText(OPENING.reply);

        expect((tutorTurn.mock.calls[0][0] as TutorTurnRequest).language).toBe("th");
    });

    it("keeps every onboarding language in a collapsed dropdown", async () => {
        await act(() => setFirstLanguage("hi"));
        withScreenReader(false);
        const user = userEvent.setup();
        render(<SpeakScreen />);

        expect(await screen.findByText("हिन्दी")).toBeTruthy();
        expect(screen.queryByText("ไทย")).toBeNull();
        await user.press(screen.getByText("हिन्दी"));
        for (const ownName of Object.values(FIRST_LANGUAGE_LABELS)) {
            expect(screen.getAllByText(ownName).length).toBeGreaterThan(0);
        }
    });

    it("sends nothing until Send, and lets the learner delete a recording first", async () => {
        withScreenReader(false);
        tutorTurn.mockResolvedValueOnce(OPENING).mockResolvedValueOnce(answer("met"));
        const user = await startConversation();

        await recordAndStop(user);
        await user.press(await screen.findByLabelText(label("delete")));
        expect(mockDeleted).toEqual([RECORDING]);
        expect(await screen.findByLabelText(label("record"))).toBeTruthy();
        expect(tutorTurn).toHaveBeenCalledTimes(1);

        await recordAndStop(user);
        await user.press(await screen.findByLabelText(label("send")));

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

        await user.press(screen.getByLabelText(label("record")));
        await user.press(await screen.findByLabelText(label("cancel")));

        expect(await screen.findByLabelText(label("record"))).toBeTruthy();
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
        await user.press(await screen.findByLabelText(label("send")));
        await screen.findByText(label("sendFailed"));
        expect(mockDeleted).toEqual([]);

        await user.press(screen.getByLabelText(label("send")));
        // The tutor could not make this one out, and the screen says so.
        await screen.findByText(label("notHeard"));
        expect(tutorTurn).toHaveBeenCalledTimes(3);
    });

    it("does not save a tutor reply that arrives after leaving", async () => {
        withScreenReader(false);
        let resolve!: (response: typeof OPENING) => void;
        tutorTurn.mockReturnValueOnce(
            new Promise((done) => {
                resolve = done;
            }),
        );
        const user = userEvent.setup();
        const view = render(<SpeakScreen />);
        await user.press(await screen.findByText(label("start")));
        view.unmount();
        await act(async () => {
            resolve(OPENING);
        });
        expect(mockFiles.size).toBe(0);
        expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it("disables tutor replay while the microphone is recording", async () => {
        withScreenReader(false);
        tutorTurn.mockResolvedValueOnce(OPENING);
        const user = await startConversation();
        await user.press(screen.getByLabelText(label("record")));
        await screen.findByLabelText(label("stop"));
        const count = mockPlayer.play.mock.calls.length;
        await user.press(screen.getByLabelText(label("play")));
        expect(mockPlayer.play).toHaveBeenCalledTimes(count);
        await user.press(screen.getByLabelText(label("cancel")));
    });

    it("leaves the tutor's voice to the learner under a screen reader", async () => {
        withScreenReader(true);
        tutorTurn.mockResolvedValueOnce(OPENING);
        await startConversation();

        expect(mockPlayer.play).not.toHaveBeenCalled();
        expect(screen.getByLabelText(label("play"))).toBeTruthy();
    });
});
