import { useSignIn } from "@clerk/expo";
import { Link } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button, Screen, Text, TextField } from "@/components/ui";
import { clerkErrorMessage } from "@/lib/clerkErrors";
import { useGoogleSignIn } from "@/lib/clerkSettings";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

export default function SignInScreen() {
    const t = useTranslations("mobile.auth");
    const { signIn, fetchStatus } = useSignIn();
    // Google is a per-instance Clerk setting; hide the button where it is off
    const googleEnabled = useGoogleSignIn();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submittingRef = useRef(false);

    const canSubmit = !!email.trim() && !!password;

    const handleSignIn = useCallback(async () => {
        if (!canSubmit || submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            const { error: authError } = await signIn.password({
                emailAddress: email.trim(),
                password,
            });
            if (authError) {
                setError(clerkErrorMessage(authError, t("genericError")));
            } else if (signIn.status === "complete") {
                const { error: finalizeError } = await signIn.finalize();
                if (finalizeError) {
                    setError(clerkErrorMessage(finalizeError, t("genericError")));
                }
                // The (auth) layout redirects once Clerk reports isSignedIn
            } else if (
                signIn.status === "needs_second_factor" ||
                signIn.status === "needs_client_trust"
            ) {
                // MFA is not enabled on the Clerk instance today; if it ever
                // is, the app can't complete it yet — point at the website
                setError(t("mfaUnsupported"));
            } else {
                setError(t("genericError"));
            }
        } catch (err) {
            setError(clerkErrorMessage(err, t("genericError")));
        } finally {
            submittingRef.current = false;
            setBusy(false);
        }
    }, [canSubmit, email, password, signIn, t]);

    return (
        <Screen edges={["top", "bottom", "left", "right"]}>
            <View style={styles.container}>
                <AuthHeader title={t("welcome")} subtitle={t("tagline")} />

                <View style={styles.form}>
                    <TextField
                        label={t("email")}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        textContentType="emailAddress"
                    />
                    <TextField
                        label={t("password")}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="password"
                        textContentType="password"
                        onSubmitEditing={handleSignIn}
                    />
                    {error ? (
                        <Text variant="caption" color={colors.destructive}>
                            {error}
                        </Text>
                    ) : null}
                    <Button
                        title={t("signIn")}
                        size="lg"
                        loading={busy || fetchStatus === "fetching"}
                        disabled={!canSubmit}
                        onPress={handleSignIn}
                    />
                    <Link href="/forgot-password" asChild>
                        <Text
                            variant="caption"
                            center
                            color={colors.primaryDark}
                            style={styles.forgot}
                        >
                            {t("forgotPassword")}
                        </Text>
                    </Link>
                </View>

                {googleEnabled ? (
                    <>
                        <View style={styles.dividerRow}>
                            <View style={styles.divider} />
                            <Text variant="caption">{t("or")}</Text>
                            <View style={styles.divider} />
                        </View>
                        <GoogleButton title={t("continueWithGoogle")} onError={setError} />
                    </>
                ) : null}

                <View style={styles.footer}>
                    <Text variant="caption">{t("noAccount")}</Text>
                    <Link href="/sign-up" asChild>
                        <Text variant="bodyStrong" color={colors.primaryDark}>
                            {t("signUp")}
                        </Text>
                    </Link>
                </View>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", paddingVertical: spacing.xl },
    form: { gap: spacing.md },
    forgot: { paddingVertical: spacing.xs, fontWeight: "600" },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginVertical: spacing.lg,
    },
    divider: { flex: 1, height: 1, backgroundColor: colors.border },
    footer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: spacing.sm,
        marginTop: spacing.xl,
    },
});
