import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";
import { Dimensions } from "react-native";

/** Android's line between a phone and a tablet: the shorter side, in dp. */
const LARGE_SCREEN_MIN_DP = 600;

export function isLargeScreen({ width, height }: { width: number; height: number }) {
    return Math.min(width, height) >= LARGE_SCREEN_MIN_DP;
}

/**
 * Upright on phones, either way round on tablets and open foldables.
 *
 * A phone on its side leaves too little height for a question and its answers.
 * Tablets have the room, and from Android 16 the system ignores an orientation
 * lock on them anyway, so the manifest locks nothing and phones are held
 * upright from here instead. Folding or unfolding a phone changes which one it
 * is, so this is decided again whenever the screen changes.
 */
export function usePortraitOnPhones() {
    useEffect(() => {
        let large: boolean | undefined;
        const apply = () => {
            const now = isLargeScreen(Dimensions.get("screen"));
            if (now === large) return;
            large = now;
            // Only ever cosmetic: if it fails, the screen simply turns.
            const change = now
                ? ScreenOrientation.unlockAsync()
                : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            change.catch((error: unknown) => console.warn("Could not set orientation", error));
        };
        apply();
        const subscription = Dimensions.addEventListener("change", apply);
        return () => subscription.remove();
    }, []);
}
