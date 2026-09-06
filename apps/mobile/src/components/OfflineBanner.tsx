import Ionicons from "@expo/vector-icons/Ionicons";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

// Slim banner under the status bar while the device has no usable
// connection. Everything in the app needs the API, so one global signal is
// clearer than per-screen errors.
export function OfflineBanner() {
    const t = useTranslations("mobile.common");
    const insets = useSafeAreaInsets();
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            // isInternetReachable is null while unknown — treat as online
            setOffline(
                state.isConnected === false || state.isInternetReachable === false,
            );
        });
        return unsubscribe;
    }, []);

    if (!offline) return null;

    return (
        <View
            accessibilityLiveRegion="polite"
            style={[styles.banner, { paddingTop: insets.top + spacing.xs }]}
        >
            <Ionicons name="cloud-offline-outline" size={16} color={colors.white} />
            <Text variant="caption" color={colors.white} style={styles.text}>
                {t("offlineBanner")}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        backgroundColor: colors.foreground,
        paddingBottom: spacing.xs,
        paddingHorizontal: spacing.md,
    },
    text: { fontWeight: "600", lineHeight: 18 },
});
