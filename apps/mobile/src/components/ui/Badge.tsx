import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/lib/theme";

import { Text } from "./Text";

type Tone = "neutral" | "success" | "warning" | "danger" | "primary" | "accent";

const TONES: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: colors.mutedSurface, fg: colors.foreground },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.destructiveSoft, fg: colors.destructive },
    primary: { bg: colors.primarySoft, fg: colors.onPrimary },
    accent: { bg: colors.accentSoft, fg: "#0e6b7b" },
};

type Props = {
    label: string;
    tone?: Tone;
    /** Says the same thing as the colour, for a learner who cannot tell the colours apart. */
    icon?: React.ComponentProps<typeof Ionicons>["name"];
};

export function Badge({ label, tone = "neutral", icon }: Props) {
    const palette = TONES[tone];
    return (
        <View style={[styles.badge, { backgroundColor: palette.bg }]}>
            {icon ? <Ionicons name={icon} size={14} color={palette.fg} /> : null}
            <Text variant="caption" color={palette.fg} style={styles.text}>
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        // Long labels (Tamil, Bengali) wrap inside the pill instead of
        // pushing it off-screen
        flexShrink: 1,
        maxWidth: "100%",
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    text: { fontWeight: "600", lineHeight: 18, flexShrink: 1 },
});
