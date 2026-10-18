import { StyleSheet, View, type ViewProps } from "react-native";

import { colors, radius, spacing } from "@/lib/theme";

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
    // A key that does not press: the same light edge as the Home lesson cards.
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderBottomWidth: 6,
        borderColor: colors.key,
    },
    muted: { backgroundColor: colors.mutedSurface },
    padded: { padding: spacing.lg },
});
