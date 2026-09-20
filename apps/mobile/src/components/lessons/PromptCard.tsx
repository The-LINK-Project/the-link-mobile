import { StyleSheet, View } from "react-native";

import { VocabularyVisual } from "@/components/lessons/LessonVisual";
import { Card } from "@/components/ui";
import type { PictureKey } from "@/lib/lessons/icons";
import { spacing } from "@/lib/theme";

/**
 * What the learner is being asked to say, with the picture of what it is about.
 *
 * Only for exercises where the meaning is already on the card in words. There
 * the picture gives nothing away, and it lets a learner who reads slowly see
 * what the sentence is about before they have finished reading it. A listening
 * exercise must not use this: the picture would answer it.
 */
export function PromptCard({
    picture,
    tone,
    children,
}: {
    /** Left out when no word in the exercise has a picture. */
    picture?: PictureKey;
    tone?: "default" | "muted";
    children: React.ReactNode;
}) {
    return (
        <Card tone={tone} style={styles.card}>
            {picture ? (
                <View
                    style={styles.picture}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                >
                    <VocabularyVisual picture={picture} fill />
                </View>
            ) : null}
            <View style={styles.text}>{children}</View>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    picture: { width: 96, height: 96, flexShrink: 0 },
    text: { flex: 1 },
});
