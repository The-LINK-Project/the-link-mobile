import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from "react-native";

import { colors, radius, spacing, TOUCH_TARGET } from "@/lib/theme";

import { usePressGuard } from "./PressGuard";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "ghostDestructive";
type Size = "sm" | "md" | "lg";

const KEYED = new Set<Variant>(["primary", "secondary", "outline", "destructive"]);

type Props = Omit<PressableProps, "style" | "children"> & {
    title: string;
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /**
     * Only the icon, with the title kept for screen readers: for a button
     * sharing its row with two others, where a long word in a learner's
     * language would otherwise leave the middle one no room.
     */
    compact?: boolean;
    /**
     * Under a PressGuard, a press of this kind stays live right after one of
     * its own: Back where Back was, Next where Next was.
     */
    steady?: string;
};

const TEXT_COLOR: Record<Variant, string> = {
    primary: colors.onPrimary,
    secondary: colors.ink,
    outline: colors.link,
    ghost: colors.muted,
    destructive: colors.white,
    ghostDestructive: colors.destructive,
};

/** The height of a key's lower edge, which it sinks into when pressed. */
const EDGE = 4;

export function Button({
    title,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    icon,
    style,
    compact = false,
    steady,
    onPress,
    ...rest
}: Props) {
    const isDisabled = disabled || loading;
    // Under a guard, a press just after the buttons changed is let fall,
    // without the button sinking as if it had been taken (see PressGuard).
    const guard = usePressGuard();
    const holding = guard?.holding(steady) ?? false;
    const press: PressableProps["onPress"] =
        guard && onPress
            ? (event) => {
                  if (!guard.allows(steady)) return;
                  guard.note(steady);
                  onPress(event);
              }
            : onPress;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ disabled: !!isDisabled, busy: loading }}
            disabled={isDisabled}
            // Small buttons are drawn at 40dp; the extra slop brings the touch
            // target to the 48dp Android minimum without changing the look
            hitSlop={size === "sm" ? { top: 4, bottom: 4 } : undefined}
            {...rest}
            onPress={press}
            style={({ pressed }) => [
                styles.base,
                styles[variant],
                styles[`size_${size}`],
                compact ? styles.compact : null,
                pressed && !isDisabled && !holding
                    ? variant === "outline"
                        ? styles.pressedOutline
                        : KEYED.has(variant)
                          ? styles.pressed
                          : styles.pressedFlat
                    : null,
                isDisabled
                    ? variant === "primary"
                        ? styles.disabledPrimary
                        : styles.disabled
                    : null,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    color={
                        isDisabled && variant === "primary" ? colors.keyText : TEXT_COLOR[variant]
                    }
                />
            ) : (
                <>
                    {icon}
                    {compact && icon ? null : (
                        <Text
                            variant="bodyStrong"
                            color={
                                isDisabled && variant === "primary"
                                    ? colors.keyText
                                    : TEXT_COLOR[variant]
                            }
                            style={[styles.label, size === "sm" ? styles.smallText : null]}
                        >
                            {title}
                        </Text>
                    )}
                </>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: "transparent",
    },
    // Keys, like the lesson cards on Home: a darker lower edge.
    primary: {
        backgroundColor: colors.primary,
        borderBottomWidth: EDGE,
        borderBottomColor: colors.primaryLip,
    },
    secondary: {
        backgroundColor: colors.mutedSurface,
        borderBottomWidth: EDGE,
        borderBottomColor: colors.keyLip,
    },
    outline: {
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderBottomWidth: EDGE + 2,
        borderColor: colors.key,
    },
    ghost: { backgroundColor: "transparent" },
    destructive: {
        backgroundColor: colors.destructive,
        borderBottomWidth: EDGE,
        borderBottomColor: "#98200c",
    },
    ghostDestructive: { backgroundColor: "transparent" },
    size_sm: { minHeight: 40, paddingHorizontal: spacing.md },
    size_md: { minHeight: TOUCH_TARGET, paddingHorizontal: spacing.lg },
    size_lg: { minHeight: 56, paddingHorizontal: spacing.xl },
    // An icon alone, still a full-size key to press.
    compact: { minWidth: 56, paddingHorizontal: spacing.md },
    label: {
        flexShrink: 1,
        textAlign: "center",
        paddingVertical: spacing.xs,
        fontSize: 15,
        fontWeight: "800",
        letterSpacing: 0.6,
        textTransform: "uppercase",
    },
    smallText: { fontSize: 13 },
    // The key sinks into its edge; the space it leaves stays, so nothing moves.
    pressed: { transform: [{ translateY: EDGE }], borderBottomWidth: 1, marginBottom: EDGE - 1 },
    pressedOutline: { transform: [{ translateY: EDGE }], borderBottomWidth: 2, marginBottom: EDGE },
    pressedFlat: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
    disabledPrimary: { backgroundColor: colors.key, borderBottomColor: colors.keyLip },
});
