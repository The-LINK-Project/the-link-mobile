/**
 * Voice recording for speaking practice.
 *
 * Record, then review, then send. A recording can be cancelled while it runs,
 * or listened to and deleted afterwards, and nothing leaves the phone without a
 * tap on Send. The file lives in the cache only until it is sent or deleted.
 */

import {
    AudioQuality,
    IOSOutputFormat,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
    type RecordingOptions,
} from "expo-audio";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import type { TutorTurnRequest } from "@/lib/api";

import { deleteFile } from "./files";

export type Recording = NonNullable<TutorTurnRequest["audio"]>;
export type RecorderStatus = "idle" | "recording" | "recorded";

/** Longer than any sentence in a lesson, and short enough to keep uploads small. */
const MAX_RECORDING_MS = 30_000;
/** Anything shorter is an accidental tap rather than an attempt. */
const MIN_RECORDING_MS = 700;

/**
 * Android's recorder cannot write WAV, so it records AAC; iOS records plain
 * WAV. Gemini accepts both. Speech needs neither stereo nor more than 16 kHz.
 */
const OPTIONS: RecordingOptions = {
    extension: ".wav",
    sampleRate: 16_000,
    numberOfChannels: 1,
    bitRate: 32_000,
    isMeteringEnabled: true,
    ios: {
        extension: ".wav",
        outputFormat: IOSOutputFormat.LINEARPCM,
        audioQuality: AudioQuality.HIGH,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    android: { extension: ".aac", outputFormat: "aac_adts", audioEncoder: "aac" },
    web: {},
};

const MIME_TYPE: Recording["mimeType"] = Platform.OS === "android" ? "audio/aac" : "audio/wav";

export function useRecorder() {
    const recorder = useAudioRecorder(OPTIONS);
    const live = useAudioRecorderState(recorder, 100);
    const [status, setStatus] = useState<RecorderStatus>("idle");
    const [uri, setUri] = useState<string | null>(null);
    const [durationMs, setDurationMs] = useState(0);
    const [tooShort, setTooShort] = useState(false);
    /** The file on disk right now, recording or recorded, so it can always be removed. */
    const file = useRef<string | null>(null);
    const busy = useRef(false);

    const start = useCallback(async (): Promise<"started" | "denied" | "failed"> => {
        if (busy.current) return "failed";
        busy.current = true;
        try {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted) return "denied";
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync();
            recorder.record();
            file.current = recorder.uri;
            setTooShort(false);
            setStatus("recording");
            return "started";
        } catch {
            return "failed";
        } finally {
            busy.current = false;
        }
    }, [recorder]);

    const finish = useCallback(
        async (keep: boolean) => {
            if (busy.current) return;
            busy.current = true;
            try {
                const duration = recorder.getStatus().durationMillis;
                await recorder.stop();
                // Leaving record mode puts playback back on the loudspeaker on iOS.
                await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
                const recorded = recorder.uri ?? file.current;
                if (keep && recorded && duration >= MIN_RECORDING_MS) {
                    file.current = recorded;
                    setUri(recorded);
                    setDurationMs(duration);
                    setStatus("recorded");
                    return;
                }
                deleteFile(recorded);
                setTooShort(keep);
            } catch {
                deleteFile(file.current);
            } finally {
                busy.current = false;
            }
            file.current = null;
            setUri(null);
            setStatus("idle");
        },
        [recorder],
    );

    const stop = useCallback(() => finish(true), [finish]);
    const cancel = useCallback(() => finish(false), [finish]);

    /** Removes the recording: after it was sent, or when the learner throws it away. */
    const discard = useCallback(() => {
        deleteFile(file.current);
        file.current = null;
        setUri(null);
        setStatus("idle");
    }, []);

    /** The recording, for upload. It stays on disk until `discard`, so a failed send can be retried. */
    const read = useCallback(async (): Promise<Recording | null> => {
        if (!uri) return null;
        return { mimeType: MIME_TYPE, data: await new File(uri).base64() };
    }, [uri]);

    useEffect(() => {
        if (status === "recording" && live.durationMillis >= MAX_RECORDING_MS) void finish(true);
    }, [status, live.durationMillis, finish]);

    // A recording never outlives the screen that made it.
    useEffect(() => {
        const held = file;
        return () => deleteFile(held.current);
    }, []);

    // Metering is in decibels, roughly -60 for a quiet room up to 0 at full scale.
    const level =
        live.metering === undefined ? 0 : Math.max(0, Math.min(1, (live.metering + 60) / 60));

    return {
        status,
        durationMs: status === "recording" ? live.durationMillis : durationMs,
        level,
        tooShort,
        uri,
        start,
        stop,
        cancel,
        discard,
        read,
    };
}
