import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
    type ScrollViewProps,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

import { Button } from "./Button";
import { KeyboardAvoiding } from "./KeyboardAvoiding";
import { Text } from "./Text";

type Props = ScrollViewProps & {
    /** Plain View instead of ScrollView (for screens with their own lists) */
    fixed?: boolean;
    edges?: Edge[];
    padded?: boolean;
    refreshing?: boolean;
    onRefresh?: () => void;
};

/**
 * Safe-area aware page container used by every screen.
 *
 * The scrolling variant is padded by the keyboard's height (see
 * KeyboardAvoiding) so form fields never sit underneath it.
 */
export function Screen({
    fixed = false,
    edges = ["bottom", "left", "right"],
    padded = true,
    refreshing = false,
    onRefresh,
    children,
    contentContainerStyle,
    ...rest
}: Props) {
    return (
        <SafeAreaView style={styles.safe} edges={edges}>
            {fixed ? (
                <View style={[styles.fill, padded ? styles.padded : null]}>
                    {children}
                </View>
            ) : (
                <KeyboardAvoiding style={styles.fill}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        refreshControl={
                            onRefresh ? (
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor={colors.primaryDark}
                                    colors={[colors.primaryDark]}
                                />
                            ) : undefined
                        }
                        {...rest}
                        style={styles.fill}
                        contentContainerStyle={[
                            padded ? styles.padded : null,
                            styles.scrollContent,
                            contentContainerStyle,
                        ]}
                    >
                        {children}
                    </ScrollView>
                </KeyboardAvoiding>
            )}
        </SafeAreaView>
    );
}

export function LoadingState({ label }: { label?: string }) {
    return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primaryDark} />
            {label ? (
                <Text variant="caption" center style={styles.stateText}>
                    {label}
                </Text>
            ) : null}
        </View>
    );
}

export function ErrorState({
    message,
    onRetry,
    retryLabel,
}: {
    message: string;
    onRetry?: () => void;
    retryLabel?: string;
}) {
    const t = useTranslations("mobile.common");
    return (
        <View style={styles.center}>
            <Text variant="subheading" center>
                {t("crashTitle")}
            </Text>
            <Text variant="caption" center style={styles.stateText}>
                {message}
            </Text>
            {onRetry ? (
                <Button
                    title={retryLabel ?? t("retry")}
                    variant="outline"
                    onPress={onRetry}
                    style={styles.retry}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    fill: { flex: 1 },
    padded: { padding: spacing.lg },
    scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.sm,
    },
    stateText: { maxWidth: 320 },
    retry: { marginTop: spacing.md },
});
