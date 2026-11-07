import { useSignIn } from "@clerk/expo";
import { Link } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppleButton } from "@/components/auth/AppleButton";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { FormError } from "@/components/auth/FormError";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { PrivacyNotice } from "@/components/auth/PrivacyNotice";
import { Button, Screen, Text, TextField } from "@/components/ui";
import { clerkErrorMessage } from "@/lib/clerkErrors";
import { useAppleSignIn, useGoogleSignIn } from "@/lib/clerkSettings";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing, TOUCH_TARGET } from "@/lib/theme";

export default function SignInScreen() {
    const t = useTranslations("mobile.auth");
    const { signIn, fetchStatus } = useSignIn();
    // Google and Apple are per-instance Clerk settings; hide a button where it is off
    const googleEnabled = useGoogleSignIn();
    const appleEnabled = useAppleSignIn();

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
                    <FormError message={error} />
                    <Button
                        title={t("signIn")}
                        size="lg"
                        loading={busy || fetchStatus === "fetching"}
                        disabled={!canSubmit}
                        onPress={handleSignIn}
                    />
                    {/* A thumb-sized target around a one-line link. */}
                    <Link href="/forgot-password" asChild>
                        <Pressable accessibilityRole="link" style={styles.link}>
                            <Text
                                variant="caption"
                                center
                                color={colors.primaryDark}
                                style={styles.forgot}
                            >
                                {t("forgotPassword")}
                            </Text>
                        </Pressable>
                    </Link>
                </View>

                {googleEnabled || appleEnabled ? (
                    <>
                        <View style={styles.dividerRow}>
                            <View style={styles.divider} />
                            <Text variant="caption">{t("or")}</Text>
                            <View style={styles.divider} />
                        </View>
                        <View style={styles.form}>
                            {appleEnabled ? (
                                <AppleButton title={t("continueWithApple")} onError={setError} />
                            ) : null}
                            {googleEnabled ? (
                                <GoogleButton title={t("continueWithGoogle")} onError={setError} />
                            ) : null}
                        </View>
                        {/* Google and Apple make a new account here for someone who has none */}
                        <PrivacyNotice onError={setError} />
                    </>
                ) : null}

                <View style={styles.footer}>
                    <Text variant="caption">{t("noAccount")}</Text>
                    <Link href="/sign-up" asChild>
                        <Pressable accessibilityRole="link" style={styles.link}>
                            <Text variant="bodyStrong" color={colors.primaryDark}>
                                {t("signUp")}
                            </Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", paddingVertical: spacing.xl },
    form: { gap: spacing.md },
    forgot: { fontWeight: "600" },
    // Tall enough for a thumb, with the text where it was.
    link: { minHeight: TOUCH_TARGET, justifyContent: "center", paddingHorizontal: spacing.xs },
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
        alignItems: "center",
        columnGap: spacing.sm,
        // The links' own height makes up the rest of the space above.
        marginTop: spacing.md,
    },
});
