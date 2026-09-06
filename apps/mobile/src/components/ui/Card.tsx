import { StyleSheet, View, type ViewProps } from "react-native";

import { colors, radius, shadow, spacing } from "@/lib/theme";

type Props = ViewProps & { padded?: boolean; tone?: "default" | "muted" };

export function Card({ padded = true, tone = "default", style, ...rest }: Props) {
    return (
        <View
            {...rest}
            style={[
                styles.card,
                tone === "muted" ? styles.muted : null,
                padded ? styles.padded : null,
                style,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadow.card,
    },
    muted: { backgroundColor: colors.mutedSurface, shadowOpacity: 0, elevation: 0 },
    padded: { padding: spacing.lg },
});
