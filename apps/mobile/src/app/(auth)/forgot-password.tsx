import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AuthHeader } from "@/components/auth/AuthHeader";
import { Button, Screen, Text, TextField } from "@/components/ui";
import { clerkErrorMessage } from "@/lib/clerkErrors";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

type Step = "email" | "reset";

// Clerk's email-code password reset: request a code, then submit code + new
// password in one call. A successful reset signs the user in.
export default function ForgotPasswordScreen() {
    const t = useTranslations("mobile.auth");
    const router = useRouter();
    const { signIn, fetchStatus } = useSignIn();

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submittingRef = useRef(false);

    const sendCode = useCallback(async () => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            const { error: createError } = await signIn.create({ identifier: email.trim() });
            if (createError) {
                setError(clerkErrorMessage(createError, t("genericError")));
                return;
            }
            const { error: codeError } = await signIn.resetPasswordEmailCode.sendCode();
            if (codeError) {
                setError(clerkErrorMessage(codeError, t("genericError")));
                return;
            }
            setStep("reset");
        } catch (err) {
            setError(clerkErrorMessage(err, t("genericError")));
        } finally {
            submittingRef.current = false;
            setBusy(false);
        }
    }, [email, signIn, t]);

    const reset = useCallback(async () => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({
                code: code.trim(),
            });
            if (verifyError) {
                setError(clerkErrorMessage(verifyError, t("genericError")));
                return;
            }
            const { error: passwordError } = await signIn.resetPasswordEmailCode.submitPassword({
                password,
            });
            if (passwordError) {
                setError(clerkErrorMessage(passwordError, t("genericError")));
            } else if (signIn.status === "complete") {
                const { error: finalizeError } = await signIn.finalize();
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
    }, [code, password, signIn, t]);

    return (
        <Screen edges={["top", "bottom", "left", "right"]}>
            <View style={styles.container}>
                <AuthHeader
                    title={t("forgotTitle")}
                    subtitle={
                        step === "email"
                            ? t("forgotBody")
                            : t("verifyBody", { email: email.trim() })
                    }
                />

                <View style={styles.form}>
                    {step === "email" ? (
                        <TextField
                            label={t("email")}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            autoComplete="email"
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            onSubmitEditing={sendCode}
                        />
                    ) : (
                        <>
                            <TextField
                                label={t("code")}
                                value={code}
                                onChangeText={setCode}
                                keyboardType="number-pad"
                                autoComplete="one-time-code"
                                textContentType="oneTimeCode"
                                maxLength={6}
                            />
                            <TextField
                                label={t("newPassword")}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoComplete="new-password"
                                textContentType="newPassword"
                                onSubmitEditing={reset}
                            />
                        </>
                    )}

                    {error ? (
                        <Text variant="caption" color={colors.destructive}>
                            {error}
                        </Text>
                    ) : null}

                    {step === "email" ? (
                        <Button
                            title={t("sendCode")}
                            size="lg"
                            loading={busy || fetchStatus === "fetching"}
                            disabled={!email.trim()}
                            onPress={sendCode}
                        />
                    ) : (
                        <Button
                            title={t("resetPassword")}
                            size="lg"
                            loading={busy || fetchStatus === "fetching"}
                            disabled={code.trim().length < 6 || password.length < 8}
                            onPress={reset}
                        />
                    )}

                    <Button
                        title={t("backToSignIn")}
                        variant="ghost"
                        onPress={() => router.back()}
                    />
                </View>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", paddingVertical: spacing.xl },
    form: { gap: spacing.md },
});
