import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { useLocalized } from "@/lib/lessons/localized";
import { useSpeech } from "@/lib/lessons/speech";
import type { Lesson, VocabItem } from "@/lib/lessons/types";
import { colors, radius, spacing, TOUCH_TARGET } from "@/lib/theme";

/**
 * The words, before the questions.
 *
 * Without this the first thing a learner met was a question about a word nobody
 * had shown them, and the only way through was to guess. Guessing right teaches
 * nothing and guessing wrong teaches that the app is a test. Here every word is
 * shown with its meaning and can be heard as often as they like, and nothing is
 * asked of them. They start when they are ready.
 *
 * Every word of the lesson is listed, not only the ones an exercise drills. The
 * others turn up as the wrong options in a question, and a wrong option the
 * learner has never seen is not a fair one.
 */
export function LessonIntro({ lesson }: { lesson: Lesson }) {
    const t = useTranslations("mobile.lessons");
    const localized = useLocalized();
    const { speak, speaking } = useSpeech();
    const [current, setCurrent] = useState<string | null>(null);

    const words = lesson.vocab;

    const say = (item: VocabItem) => {
        setCurrent(item.id);
        void speak(item.term);
    };

    return (
        <View style={styles.container}>
            <View style={styles.hero}>
                <Text variant="label">{localized(lesson.title)}</Text>
                <Text variant="title">{t("introTitle")}</Text>
                <Text variant="caption">{t("introBody")}</Text>
            </View>

            <View style={styles.words}>
                {words.map((item) => {
                    const playing = speaking && current === item.id;
                    return (
                        <Pressable
                            key={item.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${item.term}. ${localized(item.meaning)}`}
                            accessibilityHint={t("tapToListen")}
                            onPress={() => say(item)}
                            style={({ pressed }) => [styles.word, pressed && styles.pressed]}
                        >
                            <View style={[styles.speaker, playing && styles.speakerOn]}>
                                <Ionicons
                                    name={playing ? "volume-high" : "volume-medium-outline"}
                                    size={24}
                                    color={playing ? colors.white : colors.primaryDark}
                                />
                            </View>
                            <View style={styles.wordText}>
                                <Text variant="subheading">{item.term}</Text>
                                <Text variant="caption">{localized(item.meaning)}</Text>
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl },
    hero: { gap: spacing.xs },
    words: { gap: spacing.sm },
    word: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: TOUCH_TARGET + spacing.lg,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    pressed: { opacity: 0.85 },
    speaker: {
        width: TOUCH_TARGET,
        height: TOUCH_TARGET,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
    },
    speakerOn: { backgroundColor: colors.primaryDark },
    wordText: { flex: 1, gap: 2 },
});
