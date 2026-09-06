import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { Button, Screen, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { CONTACT_URL } from "@/lib/links";
import { colors, spacing } from "@/lib/theme";

// Contact lives on the website; the app opens it in an in-app browser tab.
export default function ContactScreen() {
    const t = useTranslations("mobile.foundation");
    const a = useTranslations("mobile.account");
    const [error, setError] = useState<string | null>(null);

    const open = () => {
        setError(null);
        void WebBrowser.openBrowserAsync(CONTACT_URL).catch(() => setError(a("genericError")));
    };

    return (
        <Screen contentContainerStyle={styles.content}>
            <Stack.Screen options={{ title: t("contact") }} />
            <Text>{t("contactBody")}</Text>
            <Button title={t("contactAction")} onPress={open} />
            {error ? (
                <Text variant="caption" color={colors.destructive}>
                    {error}
                </Text>
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: { gap: spacing.lg },
});
