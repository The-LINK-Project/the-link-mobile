import * as WebBrowser from "expo-web-browser";
import { StyleSheet } from "react-native";

import { Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { PRIVACY_POLICY_URL } from "@/lib/links";
import { colors, spacing } from "@/lib/theme";

// Stands in for the link inside the translated notice, so each language can
// put "Privacy Policy" wherever its word order needs it.
const POLICY_SLOT = "\u0000";

/**
 * "By creating an account, you agree to our Privacy Policy", told before the
 * account exists how its data is used (Singapore's PDPA). Sits under every way
 * of making an account, Google included, which can create one from sign-in too.
 */
export function PrivacyNotice({ onError }: { onError: (message: string) => void }) {
    const t = useTranslations("mobile.auth");
    const [beforePolicy, afterPolicy = ""] = t("privacyNotice", { policy: POLICY_SLOT }).split(
        POLICY_SLOT,
    );

    const openPolicy = () => {
        void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL).catch(() =>
            onError(t("genericError")),
        );
    };

    return (
        <Text variant="caption" center style={styles.notice}>
            {beforePolicy}
            <Text
                variant="caption"
                color={colors.primaryDark}
                accessibilityRole="link"
                onPress={openPolicy}
                style={styles.link}
            >
                {t("privacyPolicy")}
            </Text>
            {afterPolicy}
        </Text>
    );
}

const styles = StyleSheet.create({
    notice: { marginTop: spacing.lg },
    link: { textDecorationLine: "underline" },
});
