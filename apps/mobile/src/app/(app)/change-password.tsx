import { useUser } from "@clerk/expo";
import { Stack, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Screen, Text, TextField } from "@/components/ui";
import { clerkErrorMessage } from "@/lib/clerkErrors";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

// Change the Clerk password (accounts that have one — the Account screen
// hides the entry point for Google-only sign-ins). Other sessions are kept:
// a learner changing their password on their own phone shouldn't be signed
// out of the website.
export default function ChangePasswordScreen() {
    const t = useTranslations("mobile.account");
    const router = useRouter();
    const { user } = useUser();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submittingRef = useRef(false);

    const save = useCallback(async () => {
        if (!user) return;
        if (submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            await user.updatePassword({
                currentPassword,
                newPassword,
                signOutOfOtherSessions: false,
            });
            router.back();
        } catch (err) {
            setError(clerkErrorMessage(err, t("genericError")));
        } finally {
            submittingRef.current = false;
            setBusy(false);
        }
    }, [currentPassword, newPassword, router, t, user]);

    return (
        <Screen edges={["bottom", "left", "right"]}>
            <Stack.Screen options={{ title: t("changePassword") }} />
            <View style={styles.container}>
                <View style={styles.form}>
                    <TextField
                        label={t("currentPassword")}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        autoComplete="current-password"
                        textContentType="password"
                    />
                    <TextField
                        label={t("newPassword")}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        autoComplete="new-password"
                        textContentType="newPassword"
                        onSubmitEditing={save}
                    />
                    <Text variant="caption">{t("passwordMinLength")}</Text>

                    {error ? (
                        <Text variant="caption" color={colors.destructive}>
                            {error}
                        </Text>
                    ) : null}

                    <Button
                        title={t("save")}
                        size="lg"
                        loading={busy}
                        disabled={!currentPassword || newPassword.length < 8}
                        onPress={save}
                    />
                </View>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: spacing.lg },
    form: { gap: spacing.md },
});
