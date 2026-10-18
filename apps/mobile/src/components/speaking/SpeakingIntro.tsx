import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { LessonHeading } from "@/components/lessons/LessonHeading";
import { FirstLanguagePicker } from "@/components/language/FirstLanguagePicker";
import { Button, Card, ListRow, Text } from "@/components/ui";
import { useFirstLanguageInterface } from "@/lib/firstLanguage/interfaceCopy";
import {
    FIRST_LANGUAGE_ENGLISH_NAMES,
    FIRST_LANGUAGE_LABELS,
    TRANSLATION_LANGUAGES,
    type TranslationLanguage,
} from "@/lib/firstLanguage/languages";
import type { Lesson } from "@/lib/lessons/types";
import { colors, radius, spacing } from "@/lib/theme";

type Props = {
    lesson: Lesson;
    /** The English the learner will be asked to say. */
    targets: string[];
    language: TranslationLanguage | null;
    onLanguageChange: (language: TranslationLanguage) => void;
    micBlocked: boolean;
};

/**
 * Before the conversation: which language the tutor should speak, and what the
 * learner will say. Languages are listed by their own names in their own
 * scripts, since the learner may not read the English around them.
 */
export function SpeakingIntro({ lesson, targets, language, onLanguageChange, micBlocked }: Props) {
    const t = useFirstLanguageInterface("speaking");
    const [languageOpen, setLanguageOpen] = useState(false);
    const languageLabel = language ? FIRST_LANGUAGE_LABELS[language] : t("chooseLanguage");
    const languageEnglish = language ? FIRST_LANGUAGE_ENGLISH_NAMES[language] : undefined;

    return (
        <View style={styles.container}>
            <LessonHeading lesson={lesson} title={t("title")} fraction={0.5}>
                <Text variant="caption">{t("intro")}</Text>
            </LessonHeading>

            <View style={styles.section}>
                <Text variant="label">{t("language")}</Text>
                <Card padded={false}>
                    <ListRow
                        title={languageLabel}
                        value={languageEnglish === languageLabel ? undefined : languageEnglish}
                        accessibilityLabel={`${t("language")}. ${languageLabel}`}
                        trailing="expand"
                        accessibilityState={{ expanded: languageOpen }}
                        last={!languageOpen}
                        onPress={() => setLanguageOpen((open) => !open)}
                    />
                    {languageOpen ? (
                        <FirstLanguagePicker
                            value={language}
                            languages={TRANSLATION_LANGUAGES}
                            label={t("language")}
                            onChange={(next) => {
                                onLanguageChange(next);
                                setLanguageOpen(false);
                            }}
                        />
                    ) : null}
                </Card>
            </View>

            <View style={styles.section}>
                <Text variant="label">{t("youWillSay")}</Text>
                {targets.map((target) => (
                    <View key={target} style={styles.target}>
                        <View style={styles.targetIcon}>
                            <Ionicons name="mic" size={18} color={colors.primaryDark} />
                        </View>
                        <Text variant="bodyStrong" style={styles.targetText}>
                            {target}
                        </Text>
                    </View>
                ))}
            </View>

            <View style={styles.notes}>
                <Text variant="caption">{t("privacy")}</Text>
                <Text variant="caption">{t("data")}</Text>
            </View>

            {micBlocked ? (
                <Card tone="muted" style={styles.blocked}>
                    <Text variant="caption">{t("micBlocked")}</Text>
                    <Button
                        title={t("openSettings")}
                        variant="outline"
                        onPress={() => void Linking.openSettings()}
                    />
                </Card>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: spacing.xl, paddingBottom: spacing.xl },
    target: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    targetIcon: {
        width: 36,
        height: 36,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
    },
    targetText: { flex: 1 },
    section: { gap: spacing.sm },
    notes: { gap: spacing.xs },
    blocked: { gap: spacing.md },
});
