import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Screen, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { PRIVACY_POLICY_URL } from "@/lib/links";
import { colors, spacing } from "@/lib/theme";

const SECTIONS = ["account", "shared", "learning", "ai", "delete"] as const;

// A short summary here; the full policy lives on the website and opens in an
// in-app browser tab, like Contact us.
export default function PrivacyScreen() {
    const t = useTranslations("mobile.privacy");
    const a = useTranslations("mobile.account");
    const [error, setError] = useState<string | null>(null);

    const openPolicy = () => {
        setError(null);
        void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL).catch(() =>
            setError(a("genericError")),
        );
    };

    return (
        <Screen contentContainerStyle={styles.content}>
            <Stack.Screen options={{ title: a("privacy") }} />
            {SECTIONS.map((section) => (
                <View key={section} style={styles.section}>
                    <Text variant="heading">{t(`${section}Title`)}</Text>
                    <Text>{t(`${section}Body`)}</Text>
                </View>
            ))}
            <View style={styles.section}>
                <Button title={t("fullPolicy")} variant="secondary" onPress={openPolicy} />
                {error ? (
                    <Text variant="caption" color={colors.destructive}>
                        {error}
                    </Text>
                ) : null}
            </View>
            <Text variant="caption">{t("contactHint")}</Text>
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: { gap: spacing.xl },
    section: { gap: spacing.sm },
});
