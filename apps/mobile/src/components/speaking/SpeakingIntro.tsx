import { Linking, StyleSheet, View } from "react-native";

import { Button, Card, ListRow, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { TUTOR_LANGUAGE_LABELS, type TutorLanguage } from "@/lib/speaking/context";
import { spacing } from "@/lib/theme";

type Props = {
    title: string;
    /** The English the learner will be asked to say. */
    targets: string[];
    languages: readonly TutorLanguage[];
    language: TutorLanguage | null;
    onLanguageChange: (language: TutorLanguage) => void;
    micBlocked: boolean;
};

/**
 * Before the conversation: which language the tutor should speak, and what the
 * learner will say. Languages are listed by their own names in their own
 * scripts, since the learner may not read the English around them.
 */
export function SpeakingIntro({
    title,
    targets,
    languages,
    language,
    onLanguageChange,
    micBlocked,
}: Props) {
    const t = useTranslations("mobile.speaking");

    return (
        <View style={styles.container}>
            <View style={styles.hero}>
                <Text variant="label">{title}</Text>
                <Text variant="title">{t("title")}</Text>
                <Text variant="caption">{t("intro")}</Text>
            </View>

            <View style={styles.section}>
                <Text variant="label">{t("language")}</Text>
                <Card padded={false}>
                    <View accessibilityRole="radiogroup" accessibilityLabel={t("language")}>
                        {languages.map((option, index) => (
                            <ListRow
                                key={option}
                                title={TUTOR_LANGUAGE_LABELS[option]}
                                trailing="check"
                                selected={option === language}
                                accessibilityRole="radio"
                                last={index === languages.length - 1}
                                onPress={() => onLanguageChange(option)}
                            />
                        ))}
                    </View>
                </Card>
            </View>

            <View style={styles.section}>
                <Text variant="label">{t("youWillSay")}</Text>
                {targets.map((target) => (
                    <Text key={target} variant="bodyStrong">
                        {target}
                    </Text>
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
    hero: { gap: spacing.xs, paddingTop: spacing.sm },
    section: { gap: spacing.sm },
    notes: { gap: spacing.xs },
    blocked: { gap: spacing.md },
});
