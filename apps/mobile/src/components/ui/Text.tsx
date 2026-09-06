import { StyleSheet, Text as RNText, type TextProps } from "react-native";

import { colors, fontSize } from "@/lib/theme";

type Variant =
    "display" | "title" | "heading" | "subheading" | "body" | "bodyStrong" | "caption" | "label";

type Props = TextProps & {
    variant?: Variant;
    color?: string;
    center?: boolean;
};

export function Text({ variant = "body", color, center, style, ...rest }: Props) {
    return (
        <RNText
            // Respect system font scaling but cap it so buttons and badges
            // don't overflow at the largest accessibility sizes
            maxFontSizeMultiplier={1.4}
            {...rest}
            style={[
                styles.base,
                styles[variant],
                color ? { color } : null,
                center ? styles.center : null,
                style,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    base: { color: colors.foreground },
    center: { textAlign: "center" },
    display: { fontSize: fontSize.display, fontWeight: "800", lineHeight: 40 },
    title: { fontSize: fontSize.xxl, fontWeight: "700", lineHeight: 34 },
    heading: { fontSize: fontSize.xl, fontWeight: "700", lineHeight: 28 },
    subheading: { fontSize: fontSize.lg, fontWeight: "600", lineHeight: 24 },
    body: { fontSize: fontSize.md, lineHeight: 24 },
    bodyStrong: { fontSize: fontSize.md, fontWeight: "600", lineHeight: 24 },
    caption: { fontSize: fontSize.sm, lineHeight: 20, color: colors.muted },
    label: {
        fontSize: fontSize.xs,
        fontWeight: "700",
        letterSpacing: 1,
        textTransform: "uppercase",
        color: colors.muted,
    },
});
