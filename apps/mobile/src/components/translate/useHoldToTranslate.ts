import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

import { useFirstLanguage } from "@/lib/firstLanguage/store";

/**
 * Whether a screen reader is running, asked once for the whole app.
 *
 * `useScreenReader` asks the phone again for every component that uses it and
 * re-renders that component with the answer. That is right for a screen and
 * wrong here, where the caller is every piece of text in the app: a list of
 * lessons would make several hundred native calls and render twice. So the
 * answer is kept in one place and text only renders again if it changes.
 *
 * Unknown counts as off. The cost of being wrong for the first few
 * milliseconds is words that could be held and are not yet.
 */
let screenReader = false;
let watching = false;
const listeners = new Set<() => void>();

function settle(value: boolean) {
    if (value === screenReader) return;
    screenReader = value;
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    if (!watching) {
        watching = true;
        AccessibilityInfo.isScreenReaderEnabled().then(settle, () => undefined);
        // Never removed: it is one listener for the life of the app.
        AccessibilityInfo.addEventListener("screenReaderChanged", settle);
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
}

const getScreenReader = () => screenReader;

/**
 * True when a held word should answer.
 *
 * Off until the learner has a first language, because there is nothing to
 * translate into. Off under a screen reader, because TalkBack and VoiceOver
 * have their own meaning for touch-and-hold, and read text by the paragraph,
 * which word-sized pieces must not get in the way of.
 */
export function useHoldToTranslate(): boolean {
    const [language] = useFirstLanguage();
    const reading = useSyncExternalStore(subscribe, getScreenReader, getScreenReader);
    return language !== null && !reading;
}

/** Test seam: pretend a screen reader was switched on or off. */
export function setScreenReaderForTests(value: boolean) {
    settle(value);
}
