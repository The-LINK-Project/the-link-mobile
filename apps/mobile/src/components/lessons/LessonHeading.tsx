import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { localized } from "@/lib/lessons/localized";
import type { Lesson } from "@/lib/lessons/types";
import { colors, spacing } from "@/lib/theme";

import { Medallion } from "./Medallion";

/**
 * Each lesson's colour, dark enough to carry the lesson's name on white
 * (4.5:1 or more). The MRT orange cannot, so it takes a deeper brown.
 */
const LESSON_INK: Record<Lesson["icon"], string> = {
    train: "#006b31",
    food: "#8a5200",
    clinic: "#003f85",
    work: "#6a0076",
    mix: "#98200c",
};

/**
 * The top of a lesson's own screens: its medallion, as on the Home card, the
 * screen's title, and the lesson's name under it in the lesson's colour. The
 * ring says how far through the lesson this screen is.
 */
export function LessonHeading({
    lesson,
    title,
    fraction = 0,
    done = false,
    children,
}: {
    lesson: Lesson;
    title: string;
    /** How much of the lesson is behind the learner, from 0 to 1. */
    fraction?: number;
    done?: boolean;
    /** Anything that belongs with the heading, under it. */
    children?: ReactNode;
}) {
    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Medallion icon={lesson.icon} fraction={fraction} done={done} />
                <View style={styles.text}>
                    <Text variant="title" accessibilityRole="header" style={styles.title}>
                        {title}
                    </Text>
                    <Text style={[styles.lesson, { color: LESSON_INK[lesson.icon] }]}>
                        {localized(lesson.title, "en")}
                    </Text>
                </View>
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.md, paddingTop: spacing.xs },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    text: { flex: 1, minWidth: 0, gap: 2 },
    title: { fontSize: 26, lineHeight: 32, color: colors.ink },
    lesson: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
});
