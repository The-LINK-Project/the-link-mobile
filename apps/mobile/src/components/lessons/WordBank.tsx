import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import { colors, radius, spacing } from "@/lib/theme";

import { Tile } from "./Tile";

/**
 * Word bank plus answer row. Shared by every exercise where the learner builds
 * a sentence out of tiles, which is how all production is done in this app —
 * there is no keyboard anywhere in a lesson, because a keyboard is the single
 * biggest friction point for a learner with low digital literacy.
 *
 * Tiles are tracked by index rather than by text, so a sentence can repeat a
 * word ("tap in and tap out") without the two tiles being confused.
 */
type Props = {
    /** Every tile offered, including decoys. Pass already-shuffled. */
    tokens: string[];
    /** Indices into `tokens`, in the order the learner placed them. */
    placed: number[];
    onChange: (placed: number[]) => void;
    disabled?: boolean;
    /** Set after grading so the answer row can show the outcome. */
    outcome?: "correct" | "incorrect";
    /** Shown in the answer row while it is empty. */
    placeholder?: string;
};

export function WordBank({ tokens, placed, onChange, disabled, outcome, placeholder }: Props) {
    const t = useFirstLanguageInterface("lessons");
    const used = new Set(placed);

    return (
        <View style={styles.container}>
            <View
                style={[
                    styles.answerRow,
                    outcome === "correct" && styles.answerCorrect,
                    outcome === "incorrect" && styles.answerIncorrect,
                ]}
            >
                {placed.length === 0 ? (
                    <Text variant="caption" style={styles.placeholder}>
                        {placeholder}
                    </Text>
                ) : (
                    placed.map((tokenIndex, slot) => (
                        <Tile
                            key={`${tokenIndex}-${slot}`}
                            label={tokens[tokenIndex]}
                            state={
                                outcome === "correct"
                                    ? "correct"
                                    : outcome === "incorrect"
                                      ? "incorrect"
                                      : "default"
                            }
                            disabled={disabled}
                            accessibilityHint={t("tileRemove")}
                            // Removing from the middle keeps the rest of the sentence intact.
                            onPress={() => onChange(placed.filter((_, index) => index !== slot))}
                        />
                    ))
                )}
            </View>

            <View style={styles.bank}>
                {tokens.map((token, tokenIndex) => (
                    <Tile
                        key={`${token}-${tokenIndex}`}
                        label={token}
                        // A placed tile keeps its slot in the grid and is only dimmed, so
                        // the bank never reflows mid-exercise.
                        state={used.has(tokenIndex) ? "used" : "default"}
                        disabled={disabled}
                        accessibilityHint={t("tileAdd")}
                        onPress={() => onChange([...placed, tokenIndex])}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl },
    answerRow: {
        minHeight: 96,
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "flex-start",
        alignContent: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    answerCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft },
    answerIncorrect: { borderColor: colors.destructive, backgroundColor: colors.destructiveSoft },
    placeholder: { padding: spacing.sm },
    bank: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        justifyContent: "center",
    },
});
