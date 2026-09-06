import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { ErrorState, LoadingState, Screen, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { useMe } from "@/lib/queries";
import { colors, spacing } from "@/lib/theme";

// The Home tab is intentionally empty: lessons, games, and activities are
// mobile-owned features that have not been designed yet. This screen only
// proves the account is synced and leaves an obvious place for them.
export default function HomeScreen() {
    const t = useTranslations("mobile.foundation");
    const me = useMe();

    return (
        <Screen edges={["top", "left", "right"]} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Image
                    source={require("../../../../assets/images/icon.png")}
                    style={styles.logo}
                    accessibilityLabel="The LINK Project"
                />
                <Text variant="title">{t("welcome")}</Text>
            </View>

            {me.isPending ? (
                <LoadingState />
            ) : me.isError ? (
                <ErrorState message={t("syncError")} onRetry={() => void me.refetch()} />
            ) : (
                <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                        <Ionicons name="sparkles-outline" size={28} color={colors.primaryDark} />
                    </View>
                    <Text variant="heading" center>
                        {t("empty")}
                    </Text>
                    <Text variant="caption" center style={styles.emptyBody}>
                        {t("emptyBody")}
                    </Text>
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: { paddingTop: spacing.xl },
    header: { gap: spacing.lg },
    logo: { width: 56, height: 56, borderRadius: 14 },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingVertical: spacing.xxl,
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.primarySoft,
        marginBottom: spacing.sm,
    },
    emptyBody: { maxWidth: 280 },
});
