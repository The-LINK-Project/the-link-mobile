import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "@/components/ui";
import { colors, fontSize, radius, spacing, TOUCH_TARGET } from "@/lib/theme";

/**
 * The one tappable surface every exercise is built from: word-bank words,
 * multiple-choice options, matching pairs.
 *
 * `used` is the state a word-bank tile takes once it has been placed in the
 * answer row. It stays in the grid at full size and is only dimmed, so the
 * bank never reflows and no tap target moves under the learner's finger while
 * they are working. Duolingo does the same thing.
 */
export type TileState = "default" | "selected" | "correct" | "incorrect" | "used";

type Props = {
    label: string;
    onPress?: () => void;
    state?: TileState;
    disabled?: boolean;
    /** Fill the available width, for full-width answer choices. */
    block?: boolean;
    style?: StyleProp<ViewStyle>;
    accessibilityHint?: string;
};

export function Tile({
    label,
    onPress,
    state = "default",
    disabled,
    block,
    style,
    accessibilityHint,
}: Props) {
    const isUsed = state === "used";
    const inert = disabled || isUsed || !onPress;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: !!inert, selected: state === "selected" }}
            disabled={inert}
            onPress={onPress}
            style={({ pressed }) => [
                styles.base,
                block && styles.block,
                styles[state],
                // The 4px bottom edge collapses as the tile moves down, so a press
                // reads as physical even without sound.
                pressed && !inert ? styles.pressed : null,
                disabled && !isUsed ? styles.disabled : null,
                style,
            ]}
        >
            <Text
                variant="bodyStrong"
                color={TEXT_COLOR[state]}
                style={[styles.label, isUsed && styles.usedLabel]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

const TEXT_COLOR: Record<TileState, string> = {
    default: colors.foreground,
    selected: colors.onPrimary,
    correct: colors.success,
    incorrect: colors.destructive,
    // Kept visible rather than hidden: the learner can still read what they used.
    used: colors.border,
};

const EDGE = 4;

const styles = StyleSheet.create({
    base: {
        minHeight: TOUCH_TARGET,
        justifyContent: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 2,
        borderBottomWidth: EDGE + 2,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    block: { width: "100%" },
    label: { textAlign: "center", fontSize: fontSize.md },
    usedLabel: { opacity: 0.55 },

    default: {},
    selected: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDark },
    correct: { backgroundColor: colors.successSoft, borderColor: colors.success },
    incorrect: { backgroundColor: colors.destructiveSoft, borderColor: colors.destructive },
    used: { backgroundColor: colors.mutedSurface, borderColor: colors.hairline },

    pressed: {
        transform: [{ translateY: EDGE }],
        borderBottomWidth: 2,
        marginBottom: EDGE,
    },
    disabled: { opacity: 0.5 },
});
