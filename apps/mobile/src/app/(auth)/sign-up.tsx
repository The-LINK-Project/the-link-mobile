import { useSignUp } from "@clerk/expo";
import { Link } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button, Screen, Text, TextField } from "@/components/ui";
import { clerkErrorMessage } from "@/lib/clerkErrors";
import { USERNAME_PATTERN, useGoogleSignIn, useProfileAttributes } from "@/lib/clerkSettings";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

export default function SignUpScreen() {
    const t = useTranslations("mobile.auth");
    const { signUp, fetchStatus } = useSignUp();
    // Which extra fields the active Clerk instance requires. Development and
    // production intentionally have different profile settings.
    const attributes = useProfileAttributes();
    const googleEnabled = useGoogleSignIn();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [pendingVerification, setPendingVerification] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submittingRef = useRef(false);

    // Step 1: create the sign-up and send the email code
    const handleSignUp = useCallback(async () => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            const { error: passwordError } = await signUp.password({
                emailAddress: email.trim(),
                password,
                // Only attributes the instance has enabled may be sent
                ...(attributes.username.enabled && username.trim()
                    ? { username: username.trim() }
                    : {}),
                ...(attributes.firstName.enabled && firstName.trim()
                    ? { firstName: firstName.trim() }
                    : {}),
                ...(attributes.lastName.enabled && lastName.trim()
                    ? { lastName: lastName.trim() }
                    : {}),
            });
            if (passwordError) {
                setError(clerkErrorMessage(passwordError, t("genericError")));
                return;
            }
            const { error: codeError } = await signUp.verifications.sendEmailCode();
            if (codeError) {
                setError(clerkErrorMessage(codeError, t("genericError")));
                return;
            }
            setPendingVerification(true);
        } catch (err) {
            setError(clerkErrorMessage(err, t("genericError")));
        } finally {
            submittingRef.current = false;
            setBusy(false);
        }
    }, [attributes, email, firstName, lastName, password, signUp, t, username]);

    const usernameOk =
        !attributes.username.enabled ||
        (attributes.username.required
            ? USERNAME_PATTERN.test(username.trim())
            : username.trim() === "" || USERNAME_PATTERN.test(username.trim()));
    const firstNameOk = !attributes.firstName.required || !!firstName.trim();
    const lastNameOk = !attributes.lastName.required || !!lastName.trim();

    // Step 2: verify the code and activate the session. The Clerk webhook
    // webhook keeps an existing Mongo profile current, and /v1/me creates the
    // mobile profile on first authenticated use.
    const handleVerify = useCallback(async () => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            const { error: verifyError } = await signUp.verifications.verifyEmailCode({
                code: code.trim(),
            });
            if (verifyError) {
                setError(clerkErrorMessage(verifyError, t("genericError")));
            } else if (signUp.status === "complete") {
                const { error: finalizeError } = await signUp.finalize();
                if (finalizeError) {
                    setError(clerkErrorMessage(finalizeError, t("genericError")));
                }
            } else {
                setError(t("genericError"));
            }
        } catch (err) {
            setError(clerkErrorMessage(err, t("genericError")));
        } finally {
            submittingRef.current = false;
            setBusy(false);
        }
    }, [code, signUp, t]);

    return (
        <Screen edges={["top", "bottom", "left", "right"]}>
            <View style={styles.container}>
                {pendingVerification ? (
                    <>
                        <AuthHeader
                            title={t("verifyTitle")}
                            subtitle={t("verifyBody", { email: email.trim() })}
                        />
                        <View style={styles.form}>
                            <TextField
                                label={t("code")}
                                value={code}
                                onChangeText={setCode}
                                keyboardType="number-pad"
                                autoComplete="one-time-code"
                                textContentType="oneTimeCode"
                                maxLength={6}
                                onSubmitEditing={handleVerify}
                            />
                            {error ? (
                                <Text variant="caption" color={colors.destructive}>
                                    {error}
                                </Text>
                            ) : null}
                            <Button
                                title={t("verify")}
                                size="lg"
                                loading={busy || fetchStatus === "fetching"}
                                disabled={code.trim().length < 6}
                                onPress={handleVerify}
                            />
                        </View>
                    </>
                ) : (
                    <>
                        <AuthHeader title={t("signUp")} subtitle={t("tagline")} />
                        <View style={styles.form}>
                            {/* Clerk mounts its browser CAPTCHA here on Expo web. */}
                            <View nativeID="clerk-captcha" />
                            {attributes.firstName.enabled ? (
                                <TextField
                                    label={t("firstName")}
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    autoComplete="given-name"
                                    textContentType="givenName"
                                />
                            ) : null}
                            {attributes.lastName.enabled ? (
                                <TextField
                                    label={t("lastName")}
                                    value={lastName}
                                    onChangeText={setLastName}
                                    autoComplete="family-name"
                                    textContentType="familyName"
                                />
                            ) : null}
                            {attributes.username.enabled ? (
                                <TextField
                                    label={t("username")}
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="username-new"
                                    textContentType="username"
                                    error={
                                        username.trim() && !USERNAME_PATTERN.test(username.trim())
                                            ? t("usernameHint")
                                            : null
                                    }
                                />
                            ) : null}
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
                                autoComplete="new-password"
                                textContentType="newPassword"
                                onSubmitEditing={handleSignUp}
                            />
                            {error ? (
                                <Text variant="caption" color={colors.destructive}>
                                    {error}
                                </Text>
                            ) : null}
                            <Button
                                title={t("signUp")}
                                size="lg"
                                loading={busy || fetchStatus === "fetching"}
                                disabled={
                                    !email || password.length < 8 || !usernameOk || !firstNameOk || !lastNameOk
                                }
                                onPress={handleSignUp}
                            />
                        </View>

                        {googleEnabled ? (
                            <>
                                <View style={styles.dividerRow}>
                                    <View style={styles.divider} />
                                    <Text variant="caption">{t("or")}</Text>
                                    <View style={styles.divider} />
                                </View>
                                <GoogleButton
                                    title={t("continueWithGoogle")}
                                    onError={setError}
                                />
                            </>
                        ) : null}

                        <View style={styles.footer}>
                            <Text variant="caption">{t("haveAccount")}</Text>
                            <Link href="/sign-in" asChild>
                                <Text variant="bodyStrong" color={colors.primaryDark}>
                                    {t("signIn")}
                                </Text>
                            </Link>
                        </View>
                    </>
                )}
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", paddingVertical: spacing.xl },
    form: { gap: spacing.md },
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
