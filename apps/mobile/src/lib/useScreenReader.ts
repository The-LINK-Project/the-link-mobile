import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Whether a screen reader is running, or null until that is known. */
export function useScreenReader(): boolean | null {
    const [enabled, setEnabled] = useState<boolean | null>(null);

    useEffect(() => {
        let active = true;
        const settle = (value: boolean) => {
            if (active) setEnabled(value);
        };
        AccessibilityInfo.isScreenReaderEnabled().then(settle, () => settle(false));

        // Turning a screen reader on mid-lesson does not rebuild the current
        // run, but the next one started will respect it.
        const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", settle);
        return () => {
            active = false;
            subscription.remove();
        };
    }, []);

    return enabled;
}
