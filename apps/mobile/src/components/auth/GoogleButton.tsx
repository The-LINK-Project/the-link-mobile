import { useSSO } from "@clerk/expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";

import { colors } from "@/lib/theme";

import { type SocialAttempt, SocialButton } from "./SocialButton";

// Closes the in-app browser tab once the OAuth redirect lands back in the app
WebBrowser.maybeCompleteAuthSession();

// Warming the Android Custom Tab makes the Google page open noticeably faster
function useWarmUpBrowser() {
    useEffect(() => {
        if (Platform.OS !== "android") return;
        void WebBrowser.warmUpAsync().catch(() => undefined);
        return () => {
            void WebBrowser.coolDownAsync().catch(() => undefined);
        };
    }, []);
}

/** "Continue with Google", through Google's page in an in-app browser tab. */
export function GoogleButton({
    title,
    onError,
}: {
    title: string;
    onError: (message: string) => void;
}) {
    useWarmUpBrowser();
    const { startSSOFlow } = useSSO();

    const start = useCallback(async (): Promise<SocialAttempt> => {
        const result = await startSSOFlow({
            strategy: "oauth_google",
            redirectUrl: Linking.createURL("/"),
        });
        return { ...result, finished: result.authSessionResult?.type === "success" };
    }, [startSSOFlow]);

    return (
        <SocialButton
            title={title}
            icon={<Ionicons name="logo-google" size={18} color={colors.foreground} />}
            start={start}
            onError={onError}
        />
    );
}
