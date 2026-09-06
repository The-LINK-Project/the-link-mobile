import { ClerkProvider, useAuth, useClerk } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/OfflineBanner";
import { Button, LoadingState, Text } from "@/components/ui";
import { API_BASE_URL, useApiAuth } from "@/lib/api";
import i18n, { useLocaleReady } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
// How long to wait for Clerk before showing the "sign-in unavailable" screen
const LOAD_TIMEOUT_MS = 15_000;

function AppShell() {
    const ready = useApiAuth();
    const localeReady = useLocaleReady();

    useEffect(() => {
        if (localeReady) void SplashScreen.hideAsync();
    }, [localeReady]);

    if (!ready || !localeReady) return null;
    return (
        <>
            <StatusBar style="dark" />
            <OfflineBanner />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                }}
            />
        </>
    );
}

function AccountQueries() {
    const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
    useEffect(() => () => client.clear(), [client]);
    return (
        <QueryClientProvider client={client}>
            <AppShell />
        </QueryClientProvider>
    );
}

// Shown when Clerk cannot finish its first load (no network, or a Clerk
// instance whose Native API is switched off). Without this the app would sit
// behind the splash screen forever, because nothing under ClerkProvider
// renders until Clerk reports loaded.
function AuthUnavailable({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
    useEffect(() => {
        void SplashScreen.hideAsync();
    }, []);
    if (retrying) return <LoadingState />;
    return (
        <View style={styles.fullscreenMessage}>
            <Text variant="heading">{i18n.t("mobile.common.authUnavailableTitle")}</Text>
            <Text variant="caption">{i18n.t("mobile.common.authUnavailableBody")}</Text>
            <Button title={i18n.t("mobile.common.retry")} onPress={onRetry} />
        </View>
    );
}

function Accounts({ onRetry }: { onRetry: () => void }) {
    const { isLoaded, userId } = useAuth();
    const clerk = useClerk();

    // Offline, Clerk stays in "loading" rather than failing, so also give up
    // waiting after a while. Clerk keeps loading underneath; if it succeeds
    // later the app proceeds on its own.
    const [timedOut, setTimedOut] = useState(false);
    // Clerk's status stays "error" while a reload is in flight, so track the
    // attempt ourselves to show progress. A successful load unmounts this
    // screen; a failed one hits the same timeout as the first load.
    const [retrying, setRetrying] = useState(false);
    useEffect(() => {
        if (isLoaded) return;
        const timer = setTimeout(() => {
            setTimedOut(true);
            setRetrying(false);
        }, LOAD_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [isLoaded, retrying]);

    const retry = useCallback(() => {
        // Remounting ClerkProvider re-runs Clerk's own load sequence. The React
        // SDK caches its wrapper in a static singleton, so drop that first or
        // the new provider would pick the failed one back up.
        const sdk = clerk as unknown as { constructor: { clearInstance?: () => void } };
        if (typeof sdk.constructor.clearInstance !== "function") {
            console.warn("Clerk SDK no longer exposes clearInstance; retry will not reload");
        }
        sdk.constructor.clearInstance?.();
        setTimedOut(false);
        setRetrying(true);
        onRetry();
    }, [clerk, onRetry]);

    if (clerk.status === "error" || (timedOut && !isLoaded)) {
        return <AuthUnavailable onRetry={retry} retrying={retrying} />;
    }
    if (!isLoaded) return null;
    // No persisted personal data. Changing accounts remounts the entire cache.
    return <AccountQueries key={userId ?? "signed-out"} />;
}

export default function RootLayout() {
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    if (!publishableKey || !API_BASE_URL) {
        throw new Error("Configure the mobile .env using .env.example before starting.");
    }

    return (
        <GestureHandlerRootView style={styles.fill}>
            <KeyboardProvider>
                <SafeAreaProvider>
                    <ClerkProvider
                        key={attempt}
                        publishableKey={publishableKey}
                        tokenCache={tokenCache}
                    >
                        <Accounts onRetry={retry} />
                    </ClerkProvider>
                </SafeAreaProvider>
            </KeyboardProvider>
        </GestureHandlerRootView>
    );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
    // A crash during the first render (for example a missing .env) would
    // otherwise stay hidden behind the splash screen
    useEffect(() => {
        void SplashScreen.hideAsync();
    }, []);
    return (
        <View style={styles.fullscreenMessage}>
            <Text variant="heading">{i18n.t("mobile.common.crashTitle")}</Text>
            <Text variant="caption">{i18n.t("mobile.common.crashBody")}</Text>
            <Button title={i18n.t("mobile.common.retry")} onPress={() => void retry()} />
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    fullscreenMessage: {
        flex: 1,
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.background,
    },
});
