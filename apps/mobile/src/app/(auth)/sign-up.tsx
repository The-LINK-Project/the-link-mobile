import { useSignUp } from "@clerk/expo";
import { Link } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { FormError } from "@/components/auth/FormError";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { PrivacyNotice } from "@/components/auth/PrivacyNotice";
import { Button, Screen, Text, TextField } from "@/components/ui";
import { clerkErrorMessage } from "@/lib/clerkErrors";
import { USERNAME_PATTERN, useGoogleSignIn, useProfileAttributes } from "@/lib/clerkSettings";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing, TOUCH_TARGET } from "@/lib/theme";

/**
 * A sign-up waiting for its email code, to carry on with. Android closes an app
 * in the background to free memory, and a learner who went to their email app
 * for the code would otherwise come back to an empty form; filling it in again
 * sends a new code, and the one they just read stops working.
 */
function waitingForCode(signUp: ReturnType<typeof useSignUp>["signUp"]): string | null {
    if (signUp.status !== "missing_requirements" || !signUp.emailAddress) return null;
    return signUp.unverifiedFields.includes("email_address") ? signUp.emailAddress : null;
}

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
    const [email, setEmail] = useState(() => waitingForCode(signUp) ?? "");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [pendingVerification, setPendingVerification] = useState(
        () => waitingForCode(signUp) !== null,
    );
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submittingRef = useRef(false);

    const usernameOk =
        !attributes.username.enabled ||
        (attributes.username.required
            ? USERNAME_PATTERN.test(username.trim())
            : username.trim() === "" || USERNAME_PATTERN.test(username.trim()));
    const firstNameOk = !attributes.firstName.required || !!firstName.trim();
    const lastNameOk = !attributes.lastName.required || !!lastName.trim();
    const canSubmit =
        !!email.trim() && password.length >= 8 && usernameOk && firstNameOk && lastNameOk;
    const canVerify = code.trim().length === 6;

    // Step 1: create the sign-up and send the email code
    const handleSignUp = useCallback(async () => {
        if (!canSubmit || submittingRef.current) return;
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
    }, [attributes, canSubmit, email, firstName, lastName, password, signUp, t, username]);

    // Step 2: verify the code and activate the session. The Clerk webhook
    // keeps an existing Mongo profile current, and /v1/me creates the mobile
    // profile on first authenticated use.
    const handleVerify = useCallback(async () => {
        if (!canVerify || submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            // A code already taken is used up. When it was the step after it,
            // activating the session, that failed, only that step is tried
            // again: checking the code a second time would fail for ever.
            if (signUp.status !== "complete") {
                const { error: verifyError } = await signUp.verifications.verifyEmailCode({
                    code: code.trim(),
                });
                if (verifyError) {
                    setError(clerkErrorMessage(verifyError, t("genericError")));
                    return;
                }
            }
            if (signUp.status === "complete") {
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
    }, [canVerify, code, signUp, t]);

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
                            <FormError message={error} />
                            <Button
                                title={t("verify")}
                                size="lg"
                                loading={busy || fetchStatus === "fetching"}
                                disabled={!canVerify}
                                onPress={handleVerify}
                            />
                            <Button
                                title={t("changeEmail")}
                                variant="ghost"
                                disabled={busy}
                                onPress={() => {
                                    setCode("");
                                    setError(null);
                                    setPendingVerification(false);
                                }}
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
                            <Text variant="caption">{t("passwordMinLength")}</Text>
                            <FormError message={error} />
                            <Button
                                title={t("signUp")}
                                size="lg"
                                loading={busy || fetchStatus === "fetching"}
                                disabled={!canSubmit}
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
                                <GoogleButton title={t("continueWithGoogle")} onError={setError} />
                            </>
                        ) : null}
                        <PrivacyNotice onError={setError} />

                        <View style={styles.footer}>
                            <Text variant="caption">{t("haveAccount")}</Text>
                            <Link href="/sign-in" asChild>
                                <Pressable accessibilityRole="link" style={styles.link}>
                                    <Text variant="bodyStrong" color={colors.primaryDark}>
                                        {t("signIn")}
                                    </Text>
                                </Pressable>
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
        alignItems: "center",
        columnGap: spacing.sm,
        // The link's own height makes up the rest of the space above.
        marginTop: spacing.md,
    },
    // Tall enough for a thumb, with the text where it was.
    link: { minHeight: TOUCH_TARGET, justifyContent: "center", paddingHorizontal: spacing.xs },
});
