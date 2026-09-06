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

export function Badge({
    label,
    tone = "neutral",
}: {
    label: string;
    tone?: Tone;
}) {
    const palette = TONES[tone];
    return (
        <View style={[styles.badge, { backgroundColor: palette.bg }]}>
            <Text variant="caption" color={palette.fg} style={styles.text}>
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignSelf: "flex-start",
        // Long labels (Tamil, Bengali) wrap inside the pill instead of
        // pushing it off-screen
        flexShrink: 1,
        maxWidth: "100%",
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    text: { fontWeight: "600", lineHeight: 18 },
});
