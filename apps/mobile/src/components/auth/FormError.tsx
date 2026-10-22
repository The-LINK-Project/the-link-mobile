import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";

import { Text } from "@/components/ui";
import { colors } from "@/lib/theme";

/**
 * Why a form was not accepted, shown under it and read out at once.
 *
 * A learner using TalkBack or VoiceOver presses Sign in and hears nothing
 * otherwise: the error appears somewhere above the button they are on. It is
 * announced rather than made a live region, because Android does not read a
 * live region that has only just appeared, and doing both would read it twice
 * where it does. Each new error is announced, including the same one again
 * after a retry, since the screens clear the error before every attempt.
 */
export function FormError({ message }: { message: string | null | undefined }) {
    useEffect(() => {
        if (message) AccessibilityInfo.announceForAccessibility(message);
    }, [message]);

    if (!message) return null;
    return (
        <Text variant="caption" color={colors.destructive} accessibilityRole="alert">
            {message}
        </Text>
    );
}
