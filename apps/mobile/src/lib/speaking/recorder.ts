import {
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import type { TutorTurnRequest } from "@/lib/api";

import { deleteFile } from "./files";
import { RECORDING_OPTIONS, RECORDING_MIME_TYPE } from "./recordingOptions";

export type Recording = NonNullable<TutorTurnRequest["audio"]>;
export type RecorderStatus = "idle" | "recording" | "recorded";

/** Longer than any sentence in a lesson, and short enough to keep uploads small. */
const MAX_RECORDING_MS = 30_000;
/** Anything shorter is an accidental tap rather than an attempt. */
const MIN_RECORDING_MS = 700;

const isBackground = () => AppState.currentState === "background";

export function useRecorder() {
    const [status, setStatus] = useState<RecorderStatus>("idle");
    const [uri, setUri] = useState<string | null>(null);
    const [durationMs, setDurationMs] = useState(0);
    const [tooShort, setTooShort] = useState(false);
    const [failed, setFailed] = useState(false);
    const file = useRef<string | null>(null);
    const busy = useRef(false);
    const permissionPending = useRef(false);
    const nativeFailure = useRef(false);
    const mounted = useRef(true);
    const phase = useRef<RecorderStatus>("idle");
    const generation = useRef(0);

    const reset = useCallback(() => {
        deleteFile(file.current);
        file.current = null;
        phase.current = "idle";
        if (mounted.current) {
            setUri(null);
            setStatus("idle");
            setDurationMs(0);
        }
    }, []);

    const playbackMode = useCallback(async () => {
        try {
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        } catch (error) {
            if (__DEV__) console.warn("Could not restore playback mode", error);
        }
    }, []);

    const recorder = useAudioRecorder(RECORDING_OPTIONS, (event) => {
        if (event.hasError && mounted.current) {
            nativeFailure.current = true;
            reset();
            setFailed(true);
            void playbackMode();
        }
    });
    const live = useAudioRecorderState(recorder, 100);

    const start = useCallback(async (): Promise<"started" | "denied" | "failed"> => {
        if (
            !mounted.current ||
            busy.current ||
            phase.current !== "idle" ||
            (AppState.currentState && AppState.currentState !== "active")
        )
            return "failed";
        busy.current = true;
        setFailed(false);
        nativeFailure.current = false;
        const request = ++generation.current;
        const cancelled = () => !mounted.current || request !== generation.current;
        let prepared = false;
        let started = false;
        let changedMode = false;
        try {
            permissionPending.current = true;
            const permission = await requestRecordingPermissionsAsync();
            permissionPending.current = false;
            if (!permission.granted) return "denied";
            if (isBackground()) return "failed";
            if (cancelled()) return "failed";
            changedMode = true;
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            if (cancelled()) return "failed";
            await recorder.prepareToRecordAsync();
            prepared = true;
            file.current = recorder.uri;
            if (cancelled()) return "failed";
            recorder.record();
            started = true;
            phase.current = "recording";
            setTooShort(false);
            setStatus("recording");
            return "started";
        } catch (error) {
            if (__DEV__) console.warn("Could not start recording", error);
            return "failed";
        } finally {
            permissionPending.current = false;
            if (!started) {
                if (prepared) {
                    try {
                        await recorder.stop();
                    } catch {
                        /* Released during navigation. */
                    }
                }
                reset();
                if (changedMode) await playbackMode();
            }
            busy.current = false;
        }
    }, [recorder, playbackMode, reset]);

    const finish = useCallback(
        async (keep: boolean) => {
            if (busy.current || phase.current !== "recording") return;
            busy.current = true;
            try {
                const duration = recorder.getStatus().durationMillis;
                await recorder.stop();
                const recorded = recorder.uri ?? file.current;
                if (
                    keep &&
                    !nativeFailure.current &&
                    mounted.current &&
                    recorded &&
                    duration >= MIN_RECORDING_MS
                ) {
                    file.current = recorded;
                    phase.current = "recorded";
                    setUri(recorded);
                    setDurationMs(duration);
                    setStatus("recorded");
                } else {
                    deleteFile(recorded);
                    reset();
                    if (mounted.current) setTooShort(keep && duration < MIN_RECORDING_MS);
                }
            } catch (error) {
                if (__DEV__) console.warn("Could not finish recording", error);
                if (mounted.current) setFailed(true);
                reset();
            } finally {
                await playbackMode();
                if (!mounted.current) reset();
                busy.current = false;
            }
        },
        [recorder, playbackMode, reset],
    );

    const stop = useCallback(() => finish(true), [finish]);
    const cancel = useCallback(() => finish(false), [finish]);
    const discard = useCallback(() => {
        if (phase.current !== "recorded" || busy.current) return;
        reset();
        setTooShort(false);
    }, [reset]);

    const read = useCallback(async (): Promise<Recording | null> => {
        if (phase.current !== "recorded" || !file.current) return null;
        return { mimeType: RECORDING_MIME_TYPE, data: await new File(file.current).base64() };
    }, []);

    useEffect(() => {
        if (status === "recording" && live.durationMillis >= MAX_RECORDING_MS) void finish(true);
    }, [status, live.durationMillis, finish]);

    useEffect(() => {
        mounted.current = true;
        const requests = generation;
        const subscription = AppState.addEventListener("change", (next) => {
            // Permission prompts temporarily background Android, even when already granted.
            if (next === "active" || permissionPending.current) return;
            ++generation.current;
            void finish(true);
        });
        return () => {
            mounted.current = false;
            ++requests.current;
            subscription.remove();
            // Pending setup/stop owns cleanup until it settles.
            if (!busy.current) {
                // useAudioRecorder has already released the native recorder.
                const wasRecording = phase.current === "recording";
                reset();
                if (wasRecording) void playbackMode();
            }
        };
    }, [finish, reset, playbackMode]);

    // Metering is in decibels, roughly -60 for a quiet room up to 0 at full scale.
    const level =
        live.metering === undefined ? 0 : Math.max(0, Math.min(1, (live.metering + 60) / 60));

    return {
        status,
        durationMs: status === "recording" ? live.durationMillis : durationMs,
        level,
        tooShort,
        failed,
        uri,
        start,
        stop,
        cancel,
        discard,
        read,
    };
}
