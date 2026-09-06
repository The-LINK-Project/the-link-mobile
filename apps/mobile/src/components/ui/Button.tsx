import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    type PressableProps,
    type StyleProp,
    type ViewStyle,
} from "react-native";

import { colors, fontSize, radius, spacing, TOUCH_TARGET } from "@/lib/theme";

import { Text } from "./Text";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

type Props = Omit<PressableProps, "style" | "children"> & {
    title: string;
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

const TEXT_COLOR: Record<Variant, string> = {
    primary: colors.onPrimary,
    secondary: colors.foreground,
    outline: colors.foreground,
    ghost: colors.foreground,
    destructive: colors.white,
};

export function Button({
    title,
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    icon,
    style,
    ...rest
}: Props) {
    const isDisabled = disabled || loading;
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
            style={({ pressed }) => [
                styles.base,
                styles[variant],
                styles[`size_${size}`],
                pressed && !isDisabled ? styles.pressed : null,
                isDisabled ? styles.disabled : null,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={TEXT_COLOR[variant]} />
            ) : (
                <>
                    {icon}
                    <Text
                        variant="bodyStrong"
                        color={TEXT_COLOR[variant]}
                        style={[styles.label, size === "sm" ? styles.smallText : null]}
                    >
                        {title}
                    </Text>
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
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: "transparent",
    },
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.mutedSurface },
    outline: { backgroundColor: colors.surface, borderColor: colors.border },
    ghost: { backgroundColor: "transparent" },
    destructive: { backgroundColor: colors.destructive },
    size_sm: { minHeight: 40, paddingHorizontal: spacing.md },
    size_md: { minHeight: TOUCH_TARGET, paddingHorizontal: spacing.lg },
    size_lg: { minHeight: 56, paddingHorizontal: spacing.xl },
    label: { flexShrink: 1, textAlign: "center", paddingVertical: spacing.xs },
    smallText: { fontSize: fontSize.sm },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
});
