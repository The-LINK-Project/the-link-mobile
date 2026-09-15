import { AudioQuality, IOSOutputFormat, type RecordingOptions } from "expo-audio";
import { Platform } from "react-native";

import type { TutorTurnRequest } from "@/lib/api";

/**
 * Android's recorder cannot write WAV, so it records AAC; iOS records plain
 * WAV. Gemini accepts both. Speech needs neither stereo nor more than 16 kHz.
 */
export const RECORDING_OPTIONS: RecordingOptions = {
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

export const RECORDING_MIME_TYPE: NonNullable<TutorTurnRequest["audio"]>["mimeType"] =
    Platform.OS === "android" ? "audio/aac" : "audio/wav";
