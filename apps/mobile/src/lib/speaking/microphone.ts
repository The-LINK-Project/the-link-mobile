import { Platform } from "react-native";

/**
 * The Android emulator on a Mac cannot open the Mac's microphone while the Mac is
 * playing any sound. It records a steady 220 Hz tone instead, and the tutor hears
 * nothing. Android keeps its speaker output running for about three seconds after
 * a sound ends, so the tutor's own voice is enough to cause it. On an emulator the
 * microphone waits until that has passed; real phones never wait.
 */
const OUTPUT_RELEASE_MS = 4_000;

export const isAndroidEmulator =
    Platform.OS === "android" &&
    /generic|emulator|sdk_gphone/i.test(
        (Platform.constants as { Fingerprint?: string }).Fingerprint ?? "",
    );

/** How long to wait before opening the microphone, given how long the app has been silent. */
export function micSettleMs(quietForMs: number, emulator = isAndroidEmulator): number {
    return emulator ? Math.max(0, OUTPUT_RELEASE_MS - quietForMs) : 0;
}
