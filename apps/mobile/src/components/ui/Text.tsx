import { StyleSheet, Text as RNText, type TextProps } from "react-native";

import { useWordSpans } from "@/components/translate/wordSpans";
import { colors, fontSize } from "@/lib/theme";

type Variant =
    "display" | "title" | "heading" | "subheading" | "body" | "bodyStrong" | "caption" | "label";

type Props = TextProps & {
    variant?: Variant;
    color?: string;
    center?: boolean;
    /**
     * Pass false for anything that is the learner's own: their name, email
     * address or username. A held word is sent off to be translated together
     * with the sentence around it, and personal details must never be in that
     * sentence. Text marked this way cannot be held at all.
     */
    translatable?: boolean;
};

/**
 * Also tells the translation bubble how far to stand off from a held word.
 * The label has no line height of its own; 16 is what its 12pt type sets to.
 */
const LINE_HEIGHT: Record<Variant, number> = {
    display: 40,
    title: 34,
    heading: 28,
    subheading: 24,
    body: 24,
    bodyStrong: 24,
    caption: 20,
    label: 16,
};

// This is the only place the app draws text, which is what lets a learner hold
// any English word on any screen: the words are made holdable here, once, and
// no screen has to know. See `useWordSpans` for when it does nothing at all.
export function Text({
    variant = "body",
    color,
    center,
    style,
    translatable = true,
    children,
    ...rest
}: Props) {
    const content = useWordSpans(children, translatable, LINE_HEIGHT[variant]);
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
        >
            {content}
        </RNText>
    );
}

const styles = StyleSheet.create({
    base: { color: colors.foreground },
    center: { textAlign: "center" },
    display: { fontSize: fontSize.display, fontWeight: "800", lineHeight: LINE_HEIGHT.display },
    title: { fontSize: fontSize.xxl, fontWeight: "700", lineHeight: LINE_HEIGHT.title },
    heading: { fontSize: fontSize.xl, fontWeight: "700", lineHeight: LINE_HEIGHT.heading },
    subheading: { fontSize: fontSize.lg, fontWeight: "600", lineHeight: LINE_HEIGHT.subheading },
    body: { fontSize: fontSize.md, lineHeight: LINE_HEIGHT.body },
    bodyStrong: { fontSize: fontSize.md, fontWeight: "600", lineHeight: LINE_HEIGHT.bodyStrong },
    caption: { fontSize: fontSize.sm, lineHeight: LINE_HEIGHT.caption, color: colors.muted },
    label: {
        fontSize: fontSize.xs,
        fontWeight: "700",
        letterSpacing: 1,
        textTransform: "uppercase",
        color: colors.muted,
    },
});
