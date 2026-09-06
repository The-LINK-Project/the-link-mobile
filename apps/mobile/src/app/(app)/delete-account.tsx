import { useClerk } from "@clerk/expo";
import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet } from "react-native";

import { Button, Screen, Text, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

const CONFIRMATION = "DELETE";

// Deleting removes the shared Clerk identity, so it signs the person out of
// the website as well. The typed confirmation guards against a stray tap.
export default function DeleteAccountScreen() {
    const t = useTranslations("mobile.account");
    const f = useTranslations("mobile.foundation");
    const router = useRouter();
    const { signOut } = useClerk();
    const [confirmation, setConfirmation] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const submittingRef = useRef(false);

    const confirmed = confirmation.trim() === CONFIRMATION;

    async function remove() {
        if (!confirmed || submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            await api.deleteAccount();
            // Signing out remounts the app on the sign-in screen. If Clerk has
            // already dropped the session, the next API 401 signs out instead.
            await signOut().catch(() => undefined);
        } catch {
            setError(t("deleteFailed"));
        } finally {
            submittingRef.current = false;
            setBusy(false);
        }
    }

    return (
        <Screen contentContainerStyle={styles.content}>
            <Stack.Screen options={{ title: t("deleteAccount") }} />
            <Text variant="heading">{t("deleteTitle")}</Text>
            <Text>{f("deleteWarning")}</Text>
            <TextField
                label={f("deleteTyped")}
                value={confirmation}
                onChangeText={setConfirmation}
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={() => void remove()}
            />
            {error ? (
                <Text variant="caption" color={colors.destructive}>
                    {error}
                </Text>
            ) : null}
            <Button
                title={t("deleteConfirm")}
                variant="destructive"
                size="lg"
                loading={busy}
                disabled={!confirmed}
                onPress={() => void remove()}
            />
            <Button
                title={t("cancel")}
                variant="outline"
                disabled={busy}
                onPress={() => router.back()}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: { gap: spacing.lg },
});
