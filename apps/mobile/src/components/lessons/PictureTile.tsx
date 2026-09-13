import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import type { PictureKey } from "@/lib/lessons/icons";
import { colors, radius, spacing } from "@/lib/theme";

import type { TileState } from "./Tile";

/**
 * A picture the learner can choose.
 *
 * The only place the lesson domain's picture keys become something drawable.
 * Swapping these icons for illustrations later changes this map and nothing
 * else — which matters, because Duolingo's own guidance on this exercise is
 * that the art carries the meaning: a picture that can be misread produces a
 * wrong answer that is not the learner's fault.
 */
const ICONS: Record<PictureKey, React.ComponentProps<typeof Ionicons>["name"]> = {
    train: "train-outline",
    platform: "subway-outline",
    exit: "exit-outline",
    money: "cash-outline",
    card: "card-outline",
    seat: "accessibility-outline",
    transfer: "swap-horizontal-outline",
    clock: "time-outline",
};

type Props = {
    picture: PictureKey;
    onPress: () => void;
    state?: TileState;
    disabled?: boolean;
    /**
     * Position in the row, read aloud instead of the word.
     *
     * Naming the picture would hand a screen-reader user the answer. Naming the
     * position keeps the tiles navigable without solving the exercise for them,
     * but it does leave this the one exercise a blind learner cannot complete.
     * The real fix is substituting a text exercise when a screen reader is
     * running, which needs a product decision rather than a label.
     */
    position: string;
};

export function PictureTile({ picture, onPress, state = "default", disabled, position }: Props) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={position}
            accessibilityState={{ disabled: !!disabled, selected: state === "selected" }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.tile,
                styles[state],
                pressed && !disabled ? styles.pressed : null,
            ]}
        >
            <View style={styles.art}>
                <Ionicons name={ICONS[picture]} size={52} color={ICON_COLOR[state]} />
            </View>
        </Pressable>
    );
}

const ICON_COLOR: Record<TileState, string> = {
    default: colors.foreground,
    selected: colors.primaryDark,
    correct: colors.success,
    incorrect: colors.destructive,
    used: colors.border,
};

const EDGE = 4;

const styles = StyleSheet.create({
    tile: {
        flex: 1,
        aspectRatio: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 2,
        borderBottomWidth: EDGE + 2,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    art: { alignItems: "center", justifyContent: "center" },
    default: {},
    selected: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDark },
    correct: { backgroundColor: colors.successSoft, borderColor: colors.success },
    incorrect: { backgroundColor: colors.destructiveSoft, borderColor: colors.destructive },
    used: { backgroundColor: colors.mutedSurface, borderColor: colors.hairline },
    pressed: { transform: [{ translateY: EDGE }], borderBottomWidth: 2, marginBottom: EDGE },
});
