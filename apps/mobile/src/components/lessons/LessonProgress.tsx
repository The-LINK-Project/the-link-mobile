import { StyleSheet, View } from "react-native";

import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { colors, radius } from "@/lib/theme";

/**
 * Progress through a lesson.
 *
 * Fed `position / queue.length`, which only ever rises: a missed exercise is
 * added to the end of the queue rather than rewinding the bar, so a mistake
 * slows progress instead of undoing it.
 */
export function LessonProgress({ value }: { value: number }) {
    const t = useFirstLanguageInterface("lessons");
    const clamped = Math.max(0, Math.min(1, value));

    return (
        <View
            accessibilityRole="progressbar"
            accessibilityLabel={t("progress")}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
            style={styles.track}
        >
            <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        flex: 1,
        height: 16,
        borderRadius: radius.full,
        backgroundColor: colors.mutedSurface,
        overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.primary },
});
