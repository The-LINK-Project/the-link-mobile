import { useSSO } from "@clerk/expo";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { Button, TextField } from "@/components/ui";
import { clerkErrorMessage } from "@/lib/clerkErrors";
import { useTranslations } from "@/lib/i18n";
import { USERNAME_PATTERN } from "@/lib/clerkSettings";
import { colors } from "@/lib/theme";

const EMPTY_FIELDS: string[] = [];

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

export function GoogleButton({
    title,
    onError,
}: {
    title: string;
    onError: (message: string) => void;
}) {
    useWarmUpBrowser();
    const { startSSOFlow } = useSSO();
    const [busy, setBusy] = useState(false);
    const sendingRef = useRef(false);
    const t = useTranslations("mobile.auth");
    const ta = useTranslations("mobile.account");
    const [pending, setPending] = useState<Awaited<ReturnType<typeof startSSOFlow>> | null>(null);
    const [username, setUsername] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const missing = pending?.signUp?.missingFields ?? EMPTY_FIELDS;

    const handlePress = useCallback(async () => {
        if (sendingRef.current) return;
        sendingRef.current = true;
        setBusy(true);
        try {
            if (pending?.signUp) {
                const attempt = await pending.signUp.update({
                    ...(missing.includes("username") ? { username: username.trim() } : {}),
                    ...(missing.includes("first_name") ? { firstName: firstName.trim() } : {}),
                    ...(missing.includes("last_name") ? { lastName: lastName.trim() } : {}),
                });
                if (attempt.status === "complete" && pending.setActive) {
                    await pending.setActive({ session: attempt.createdSessionId });
                } else {
                    onError(t("genericError"));
                }
                return;
            }
            const result = await startSSOFlow({
                strategy: "oauth_google",
                redirectUrl: Linking.createURL("/"),
            });
            if (result.createdSessionId && result.setActive) {
                await result.setActive({ session: result.createdSessionId });
            } else if (result.signUp?.status === "missing_requirements" &&
                result.signUp.missingFields.length > 0 &&
                result.signUp.missingFields.every((field) => ["username", "first_name", "last_name"].includes(field))) {
                setPending(result);
            } else if (result.authSessionResult?.type === "success") {
                onError(result.signIn?.status === "needs_second_factor" ? t("mfaUnsupported") : t("genericError"));
            }
        } catch (error) {
            onError(clerkErrorMessage(error, t("genericError")));
        } finally {
            sendingRef.current = false;
            setBusy(false);
        }
    }, [firstName, lastName, missing, onError, pending, startSSOFlow, t, username]);

    return (
        <>
        {missing.includes("username") ? <TextField label={ta("username")} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} /> : null}
        {missing.includes("first_name") ? <TextField label={ta("firstName")} value={firstName} onChangeText={setFirstName} /> : null}
        {missing.includes("last_name") ? <TextField label={ta("lastName")} value={lastName} onChangeText={setLastName} /> : null}
        <Button
            title={pending ? t("signUp") : title}
            disabled={(missing.includes("username") && !USERNAME_PATTERN.test(username.trim())) ||
                (missing.includes("first_name") && !firstName.trim()) ||
                (missing.includes("last_name") && !lastName.trim())}
            variant="outline"
            loading={busy}
            onPress={handlePress}
            icon={<Ionicons name="logo-google" size={18} color={colors.foreground} />}
        />
        </>
    );
}
