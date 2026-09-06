import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Screen, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { spacing } from "@/lib/theme";

const SECTIONS = ["account", "shared", "delete"] as const;

export default function PrivacyScreen() {
    const t = useTranslations("mobile.privacy");
    const a = useTranslations("mobile.account");

    return (
        <Screen contentContainerStyle={styles.content}>
            <Stack.Screen options={{ title: a("privacy") }} />
            {SECTIONS.map((section) => (
                <View key={section} style={styles.section}>
                    <Text variant="heading">{t(`${section}Title`)}</Text>
                    <Text>{t(`${section}Body`)}</Text>
                </View>
            ))}
            <Text variant="caption">{t("contactHint")}</Text>
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: { gap: spacing.xl },
    section: { gap: spacing.sm },
});
