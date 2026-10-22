import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { Button, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { colors, radius, spacing, TOUCH_TARGET } from "@/lib/theme";

/*
 * Starting a lesson again, from anywhere in it. It sits at the top right as a
 * quiet key opposite Close, so it is there when wanted and out of the way of
 * the answer the rest of the time. Starting again throws answers away, so it
 * asks first, in the footer where the learner's thumb already is, with keeping
 * going as the easy choice.
 */

/** The key in the lesson's top bar. */
export function RestartButton({ open, onPress }: { open: boolean; onPress: () => void }) {
    const t = useFirstLanguageInterface("lessons");
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("restart")}
            accessibilityState={{ expanded: open }}
            onPress={onPress}
            hitSlop={8}
            style={({ pressed }) => [styles.key, (open || pressed) && styles.keyOpen]}
        >
            <Ionicons name="refresh" size={26} color={open ? colors.ink : colors.muted} />
        </Pressable>
    );
}

/** Asked in place of the footer. */
export function RestartConfirm({
    onRestart,
    onCancel,
}: {
    onRestart: () => void;
    onCancel: () => void;
}) {
    const t = useFirstLanguageInterface("lessons");
    return (
        <View style={styles.confirm} accessibilityRole="alert">
            <View style={styles.title}>
                <Ionicons name="refresh" size={24} color={colors.ink} />
                <Text variant="subheading" style={styles.titleText}>
                    {t("restartTitle")}
                </Text>
            </View>
            <Text variant="body">{t("restartBody")}</Text>
            <View style={styles.actions}>
                <Button
                    title={t("restartConfirm")}
                    size="lg"
                    variant="outline"
                    style={styles.action}
                    onPress={onRestart}
                />
                <Button
                    title={t("restartKeep")}
                    size="lg"
                    style={styles.action}
                    onPress={onCancel}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    key: {
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.full,
    },
    keyOpen: { backgroundColor: colors.mutedSurface },
    confirm: {
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: 2,
        borderTopColor: colors.key,
        backgroundColor: colors.mutedSurface,
    },
    title: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    titleText: { flexShrink: 1 },
    actions: { flexDirection: "row", gap: spacing.md },
    action: { flex: 1, minWidth: 0, paddingHorizontal: spacing.md },
});
