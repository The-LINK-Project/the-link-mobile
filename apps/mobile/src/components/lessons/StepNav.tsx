import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { colors, spacing } from "@/lib/theme";

/*
 * Every step of a lesson has a way back, and a way on where there is one: the
 * word list, each exercise, the results and the talk. Workshop facilitators
 * walk a room through a lesson together and need to go back to explain
 * something without leaving it.
 */

/**
 * Back, beside a step's main button. `compact` is the arrow alone, its name
 * kept for screen readers. It is `steady`: under a PressGuard a quick second
 * Back still goes through (see PressGuard).
 */
export function BackButton({
    onPress,
    compact = false,
}: {
    onPress: () => void;
    compact?: boolean;
}) {
    const t = useFirstLanguageInterface("lessons");
    return (
        <Button
            title={t("back")}
            size="lg"
            variant="outline"
            icon={<Ionicons name="arrow-back" size={20} color={colors.link} />}
            compact={compact}
            steady="back"
            style={styles.side}
            onPress={() => onPress()}
        />
    );
}

/** Back on the left, and the step's own way forward taking the rest of the row. */
export function WithBack({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
    if (!onBack) return <>{children}</>;
    return (
        <View style={styles.withBack}>
            <BackButton onPress={onBack} />
            <View style={styles.rest}>{children}</View>
        </View>
    );
}

/**
 * Back and Next on a row of their own, for a step whose footer is busy with
 * something else: the talk's record bar.
 */
export function StepNav({
    onBack,
    onNext,
    nextLabel,
}: {
    onBack: () => void;
    onNext?: () => void;
    nextLabel?: string;
}) {
    const t = useFirstLanguageInterface("lessons");
    return (
        <View style={styles.stepNav}>
            <Button
                title={t("back")}
                size="sm"
                variant="outline"
                icon={<Ionicons name="arrow-back" size={16} color={colors.link} />}
                steady="back"
                onPress={() => onBack()}
            />
            {onNext ? (
                <Button
                    title={nextLabel ?? t("next")}
                    size="sm"
                    variant="outline"
                    steady="next"
                    onPress={() => onNext()}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    // Narrower than the main button beside it. In a long script on a small
    // phone it is Back that gives way, wrapping its label, never the step's
    // own way forward.
    side: { flexShrink: 1, paddingHorizontal: spacing.md },
    withBack: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    // 40% leaves Back room for Burmese on one line on a 360dp Android phone.
    rest: { flex: 1, minWidth: "40%" },
    stepNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        backgroundColor: colors.surface,
    },
});
