import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Button, Text } from "@/components/ui";
import { API_BASE_URL, useApiAuth } from "@/lib/api";
import i18n, { useLocaleReady } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();
const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
function AppShell() {
  const ready = useApiAuth();
  const localeReady = useLocaleReady();
  useEffect(() => { if (localeReady) void SplashScreen.hideAsync(); }, [localeReady]);
  if (!ready || !localeReady) return null;
  return <><StatusBar style="dark" /><OfflineBanner /><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.background}}}/></>;
}
function AccountQueries() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  useEffect(() => () => { client.clear(); }, [client]);
  return <QueryClientProvider client={client}><AppShell /></QueryClientProvider>;
}
function Accounts() {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) return null;
  // No persisted personal data. Changing accounts remounts the entire cache.
  return <AccountQueries key={userId ?? "signed-out"} />;
}
export default function RootLayout() {
  if (!key || !API_BASE_URL) throw new Error("Configure the mobile .env using .env.example before starting.");
  return <GestureHandlerRootView style={{flex:1}}><KeyboardProvider><SafeAreaProvider>
    <ClerkProvider publishableKey={key} tokenCache={tokenCache}><Accounts /></ClerkProvider>
  </SafeAreaProvider></KeyboardProvider></GestureHandlerRootView>;
}
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <View style={styles.error}><Text variant="heading">{i18n.t("mobile.common.crashTitle")}</Text>
    <Text variant="caption">{i18n.t("mobile.common.crashBody")}</Text>
    <Button title={i18n.t("mobile.common.retry")} onPress={() => void retry()} /></View>;
}
const styles = StyleSheet.create({error:{flex:1,justifyContent:"center",padding:spacing.xl,gap:spacing.lg,backgroundColor:colors.background}});
