import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Tile } from "@/components/lessons/Tile";
import { useLocalized } from "@/lib/lessons/localized";
import { vocabByIds } from "@/lib/lessons/lookup";
import { seededShuffle } from "@/lib/lessons/shuffle";
import type { MatchPairsExercise } from "@/lib/lessons/types";
import { spacing } from "@/lib/theme";

import type { ExerciseProps } from "./shared";

/**
 * Tap the pairs. English terms in the left column, their meanings in the
 * learner's language on the right.
 *
 * Self-grading: a pair is judged the moment the second tile is tapped, so there
 * is no Check button. Matched pairs stay in place as dimmed tiles rather than
 * vanishing, which keeps the two columns aligned and stops the remaining tap
 * targets from sliding around.
 *
 * Sides are fixed — English always left — because a column that swaps meaning
 * between exercises is one more thing to work out before answering.
 *
 * Judging happens in the tap handler rather than in an effect watching the
 * selection, so there is no intermediate render where two tiles are selected
 * but not yet graded.
 */
const WRONG_PAIR_FEEDBACK_MS = 600;

type Side = "term" | "meaning";
type Selection = { side: Side; pairId: string } | null;
/**
 * A rejected pair, stored per side. Both columns are keyed by the same pair id,
 * so highlighting by id alone would light up a tile's own translation and hand
 * the learner the answer.
 */
type WrongPair = Record<Side, string> | null;

export function TapThePairs({
    exercise,
    lesson,
    onSelfSubmit,
    locked,
}: ExerciseProps<MatchPairsExercise>) {
    const localized = useLocalized();
    const pairs = useMemo(() => vocabByIds(lesson, exercise.vocabIds), [lesson, exercise.vocabIds]);
    const terms = useMemo(() => seededShuffle(pairs, `${exercise.id}-terms`), [pairs, exercise.id]);
    const meanings = useMemo(
        () => seededShuffle(pairs, `${exercise.id}-meanings`),
        [pairs, exercise.id],
    );

    const [matched, setMatched] = useState<string[]>([]);
    const [selected, setSelected] = useState<Selection>(null);
    /** The rejected pair, held just long enough to be seen. */
    const [wrongPair, setWrongPair] = useState<WrongPair>(null);
    const wrongAttempts = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    const tap = useCallback(
        (side: Side, pairId: string) => {
            if (matched.includes(pairId)) return;

            // Nothing chosen yet, or re-choosing on the same side: just select.
            if (!selected || selected.side === side) {
                setSelected({ side, pairId });
                return;
            }

            if (selected.pairId === pairId) {
                const nextMatched = [...matched, pairId];
                setMatched(nextMatched);
                setSelected(null);
                // Every pair placed: hand the outcome to the session. Done here
                // rather than in an effect so the exercise completes on the tap
                // that finished it.
                if (nextMatched.length === pairs.length) {
                    onSelfSubmit({ kind: "pairs", wrongAttempts: wrongAttempts.current });
                }
                return;
            }

            // Wrong pair: show both halves as rejected, then clear. A wrong
            // attempt costs nothing beyond the pause — it is counted only so
            // the summary can tell a clean run from a messy one.
            wrongAttempts.current += 1;
            setWrongPair(
                side === "meaning"
                    ? { term: selected.pairId, meaning: pairId }
                    : { term: pairId, meaning: selected.pairId },
            );
            timer.current = setTimeout(() => {
                setWrongPair(null);
                setSelected(null);
            }, WRONG_PAIR_FEEDBACK_MS);
        },
        [matched, selected, pairs.length, onSelfSubmit],
    );

    // Side-aware: a tile is only lit when it is the tile that was tapped, never
    // because its counterpart in the other column was.
    const stateFor = (side: Side, pairId: string) => {
        if (matched.includes(pairId)) return "used" as const;
        if (wrongPair?.[side] === pairId) return "incorrect" as const;
        if (selected?.side === side && selected.pairId === pairId) return "selected" as const;
        return "default" as const;
    };

    return (
        <View style={styles.columns}>
            <View style={styles.column}>
                {terms.map((pair) => (
                    <Tile
                        key={pair.id}
                        label={pair.term}
                        block
                        state={stateFor("term", pair.id)}
                        disabled={locked || !!wrongPair}
                        onPress={() => tap("term", pair.id)}
                    />
                ))}
            </View>

            <View style={styles.column}>
                {meanings.map((pair) => (
                    <Tile
                        key={pair.id}
                        label={localized(pair.meaning)}
                        block
                        state={stateFor("meaning", pair.id)}
                        disabled={locked || !!wrongPair}
                        onPress={() => tap("meaning", pair.id)}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    columns: { flexDirection: "row", gap: spacing.md },
    column: { flex: 1, gap: spacing.md },
});
