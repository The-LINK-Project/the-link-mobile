import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { colors, radius, spacing, TOUCH_TARGET } from "@/lib/theme";

/**
 * Play button for listening exercises, with an optional slow replay.
 *
 * The slow button only becomes usable once the phrase has played at normal
 * speed, so the learner's first exposure is natural pace. Its space is
 * reserved from the start: appearing later would push every tile below it
 * down under a finger that is about to tap. Playback is always started by the
 * learner: nothing autoplays, and a second tap restarts rather than queues.
 */
type Props = {
    onPlay: () => void;
    onPlaySlow: () => void;
    speaking: boolean;
    /** True once a normal-speed playback has finished. Enables the slow button. */
    hasPlayed: boolean;
    disabled?: boolean;
};

export function SpeakerButton({ onPlay, onPlaySlow, speaking, hasPlayed, disabled }: Props) {
    const t = useTranslations("mobile.lessons");
    const slowDisabled = disabled || !hasPlayed;

    return (
        <View style={styles.row}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("play")}
                accessibilityState={{ disabled: !!disabled, busy: speaking }}
                disabled={disabled}
                onPress={onPlay}
                style={({ pressed }) => [
                    styles.primary,
                    pressed && !disabled ? styles.pressed : null,
                    disabled ? styles.disabledButton : null,
                ]}
            >
                {speaking ? (
                    <ActivityIndicator color={colors.white} size="large" />
                ) : (
                    <Ionicons name="volume-high" size={40} color={colors.white} />
                )}
            </Pressable>

            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("playSlow")}
                accessibilityState={{ disabled: slowDisabled }}
                // Hidden from assistive tech until it can do something.
                accessibilityElementsHidden={!hasPlayed}
                importantForAccessibility={hasPlayed ? "auto" : "no-hide-descendants"}
                disabled={slowDisabled}
                onPress={onPlaySlow}
                style={({ pressed }) => [
                    styles.secondary,
                    !hasPlayed ? styles.hidden : null,
                    pressed && !slowDisabled ? styles.pressed : null,
                    disabled ? styles.disabledButton : null,
                ]}
            >
                <Ionicons name="play-outline" size={20} color={colors.accent} />
                <Text variant="caption" color={colors.accent}>
                    {t("playSlow")}
                </Text>
            </Pressable>
        </View>
    );
}

const EDGE = 4;

const styles = StyleSheet.create({
    row: { alignItems: "center", gap: spacing.md },
    primary: {
        width: 96,
        height: 96,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
        borderBottomWidth: EDGE,
        borderColor: colors.primaryDark,
    },
    secondary: {
        minHeight: TOUCH_TARGET,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 2,
        borderBottomWidth: EDGE + 2,
        borderColor: colors.accentSoft,
        backgroundColor: colors.surface,
    },
    hidden: { opacity: 0 },
    pressed: { transform: [{ translateY: EDGE }], borderBottomWidth: 0, marginBottom: EDGE },
    disabledButton: { opacity: 0.5 },
});
