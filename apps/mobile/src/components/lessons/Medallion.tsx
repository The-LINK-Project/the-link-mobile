import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import type { LessonIcon } from "@/lib/lessons/icons";
import { colors } from "@/lib/theme";

/** One picture per lesson, so a learner can find the lesson without reading. */
export const LESSON_ICONS: Record<LessonIcon, React.ComponentProps<typeof Ionicons>["name"]> = {
    train: "train",
    clinic: "medkit",
    food: "restaurant",
    work: "construct",
    mix: "shuffle",
};

/**
 * One colour per lesson, taken from the MRT lines, so each lesson is known by
 * its colour as well as its picture. `dark` is the coin's lower edge.
 */
export const LESSON_HUES: Record<LessonIcon, { base: string; dark: string }> = {
    train: { base: "#009645", dark: "#006b31" },
    food: { base: "#fa9e0d", dark: "#b86e00" },
    clinic: { base: "#005ec4", dark: "#003f85" },
    work: { base: "#9900aa", dark: "#6a0076" },
    mix: { base: "#d42e12", dark: "#98200c" },
};

/**
 * Where a lesson stands, in the colours its card is drawn in. `ring` is the
 * outline and the ring round the picture, `lip` the card's heavier lower
 * edge. `text` is the one that carries words: bright yellow and green cannot
 * carry small type on white, so the words are a darker shade of each.
 */
export const STAGE_COLORS = {
    done: { ring: "#58cc02", lip: "#46a302", text: "#2b7a00" },
    progress: { ring: "#ffc800", lip: "#e5a800", text: colors.warning },
    next: { ring: "#1cb0f6", lip: "#1899d6", text: "#0b6fa4" },
    new: { ring: "#e5e5e5", lip: "#e5e5e5", text: "#737373" },
} as const;

const SIZES = {
    md: { ring: 78, stroke: 6, coin: 58, icon: 30, lip: 5 },
    sm: { ring: 64, stroke: 5, coin: 48, icon: 24, lip: 4 },
} as const;

/**
 * The lesson's picture on a solid coin in its own colour, with a ring round it
 * that fills as the lesson is gone through: yellow while it is under way,
 * green once it is done, with a tick on top.
 */
export function Medallion({
    icon,
    fraction,
    done,
    size = "md",
    children,
}: {
    icon: LessonIcon;
    /** How much of the lesson is behind the learner, from 0 to 1. */
    fraction: number;
    done: boolean;
    size?: keyof typeof SIZES;
    /** Drawn instead of the lesson's picture. */
    children?: ReactNode;
}) {
    const s = SIZES[size];
    const hue = LESSON_HUES[icon];

    return (
        <View
            style={[styles.frame, { width: s.ring, height: s.ring }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            <Ring
                size={s.ring}
                stroke={s.stroke}
                fraction={done ? 1 : fraction}
                color={done ? STAGE_COLORS.done.ring : STAGE_COLORS.progress.ring}
            />
            {/* The coin's darker lower edge shows below its face, the way a
                pressable thing sits on its own shadow. */}
            <View
                style={[
                    styles.coin,
                    { width: s.coin, height: s.coin, borderRadius: s.coin / 2, backgroundColor: hue.dark },
                ]}
            >
                <View
                    style={[
                        styles.face,
                        {
                            width: s.coin,
                            height: s.coin,
                            borderRadius: s.coin / 2,
                            top: -s.lip,
                            backgroundColor: hue.base,
                        },
                    ]}
                >
                    {children ?? <Ionicons name={LESSON_ICONS[icon]} size={s.icon} color={colors.white} />}
                </View>
            </View>
            {done ? (
                <View style={styles.tick}>
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                </View>
            ) : null}
        </View>
    );
}

/**
 * A ring filled clockwise from the top, drawn with views because the app has
 * no vector library. Each half of the circle is a window onto a ring that is
 * coloured on one side only; turning that ring slides its colour into view.
 */
function Ring({
    size,
    stroke,
    fraction,
    color,
}: {
    size: number;
    stroke: number;
    fraction: number;
    color: string;
}) {
    const angle = Math.min(Math.max(fraction, 0), 1) * 360;
    const circle = { width: size, height: size, borderRadius: size / 2, borderWidth: stroke };
    // Coloured on its top and right sides, turned 45°, this covers the right
    // half of the circle: 0° to 180°, measured clockwise from the top.
    const half = (turn: number) => ({
        ...circle,
        borderTopColor: color,
        borderRightColor: color,
        borderBottomColor: "transparent",
        borderLeftColor: "transparent",
        transform: [{ rotate: `${45 + turn}deg` }],
    });

    return (
        <View style={[StyleSheet.absoluteFill]}>
            <View style={[circle, { borderColor: STAGE_COLORS.new.ring }]} />
            {angle >= 360 ? (
                <View style={[circle, styles.absolute, { borderColor: color }]} />
            ) : angle > 0 ? (
                <>
                    <View style={[styles.window, { left: size / 2, width: size / 2, height: size }]}>
                        <View style={[half(Math.min(angle, 180) - 180), { marginLeft: -size / 2 }]} />
                    </View>
                    {angle > 180 ? (
                        <View style={[styles.window, { left: 0, width: size / 2, height: size }]}>
                            <View style={half(angle - 180)} />
                        </View>
                    ) : null}
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    frame: { alignItems: "center", justifyContent: "center" },
    absolute: { position: "absolute", top: 0, left: 0 },
    window: { position: "absolute", top: 0, overflow: "hidden" },
    coin: { overflow: "hidden" },
    face: { position: "absolute", left: 0, alignItems: "center", justifyContent: "center" },
    tick: {
        position: "absolute",
        top: -2,
        right: -2,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 3,
        borderColor: colors.white,
        backgroundColor: STAGE_COLORS.done.ring,
        alignItems: "center",
        justifyContent: "center",
    },
});
