import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";

import { colors, spacing, TOUCH_TARGET } from "@/lib/theme";

import { Text } from "./Text";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type Props = Omit<PressableProps, "style" | "children"> & {
    title: string;
    /** Secondary value shown before the chevron, e.g. the current language */
    value?: string;
    icon?: IconName;
    /** Trailing affordance: navigate (chevron), pick (checkmark when selected), or none */
    trailing?: "chevron" | "check" | "none";
    selected?: boolean;
    tone?: "default" | "destructive";
    /** Hide the separator under the last row of a group */
    last?: boolean;
    /** Indent to line up with the titles of icon rows above (sub-options) */
    inset?: boolean;
};

/**
 * One row of a settings-style list. Groups of rows sit inside a Card so the
 * list reads as a single surface with hairline separators between rows.
 */
export function ListRow({
    title,
    value,
    icon,
    trailing = "chevron",
    selected = false,
    tone = "default",
    last = false,
    inset = false,
    disabled,
    ...rest
}: Props) {
    const color = tone === "destructive" ? colors.destructive : colors.foreground;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={value ? `${title}, ${value}` : title}
            accessibilityState={{ disabled: !!disabled, selected }}
            disabled={disabled}
            {...rest}
            style={({ pressed }) => [
                styles.row,
                inset ? styles.inset : null,
                last ? null : styles.separator,
                pressed ? styles.pressed : null,
            ]}
        >
            {icon ? (
                <Ionicons name={icon} size={22} color={tone === "destructive" ? color : colors.muted} />
            ) : null}
            <Text color={color} style={styles.title} numberOfLines={1}>
                {title}
            </Text>
            {value ? (
                <Text variant="caption" numberOfLines={1} style={styles.value}>
                    {value}
                </Text>
            ) : null}
            {trailing === "chevron" ? (
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            ) : null}
            {trailing === "check" ? (
                <View style={styles.checkSlot}>
                    {selected ? (
                        <Ionicons name="checkmark" size={20} color={colors.primaryDark} />
                    ) : null}
                </View>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: TOUCH_TARGET + spacing.xs,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    // icon width + row gap, so the title column matches the rows above
    inset: { paddingLeft: spacing.lg + 22 + spacing.md },
    separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    pressed: { backgroundColor: colors.mutedSurface },
    title: { flex: 1 },
    value: { flexShrink: 1, maxWidth: "45%" },
    checkSlot: { width: 20, alignItems: "flex-end" },
});
