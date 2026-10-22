import { isClerkAPIResponseError, useClerk } from "@clerk/expo";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet } from "react-native";

import { Button, Screen, Text, TextField } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { eraseFirstLanguage } from "@/lib/firstLanguage/store";
import { eraseProgress } from "@/lib/progress/store";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

const CONFIRMATION = "DELETE";

// Deleting removes the shared Clerk identity, so it signs the person out of
// the website as well. The typed confirmation guards against a stray tap.
export default function DeleteAccountScreen() {
    const t = useTranslations("mobile.account");
    const f = useTranslations("mobile.foundation");
    const router = useRouter();
    const clerk = useClerk();
    const [confirmation, setConfirmation] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const submittingRef = useRef(false);
    // Taken on the first try: once the account is gone there is no user to ask.
    const userIdRef = useRef<string | undefined>(undefined);
    // A try that may have reached the server although no answer came back.
    const maybeSentRef = useRef(false);

    const confirmed = confirmation.trim() === CONFIRMATION;

    // Android reads the live region out; iOS has to be told.
    useEffect(() => {
        if (error && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(error);
    }, [error]);

    /** "All your data will be removed" includes what is on this phone. */
    async function finish(userId: string | undefined) {
        if (userId) await eraseProgress(userId);
        // The language they chose is theirs too, and the next person to use
        // this phone should be asked for their own.
        if (userId) await eraseFirstLanguage(userId);
        // Signing out remounts the app on the sign-in screen. If Clerk has
        // already dropped the session, the next API 401 signs out instead.
        await clerk.signOut().catch(() => undefined);
    }

    /**
     * Whether a delete that failed left the account gone all the same. The
     * server deletes the account before it answers, so an answer lost on a
     * weak connection can hide a deletion that happened: the session then
     * stops working, and a second try is refused as signed out.
     */
    async function accountGone(failure: unknown): Promise<boolean> {
        if (!(failure instanceof ApiError)) return false;
        if (failure.status === 401) return maybeSentRef.current;
        // Never sent (offline before a sign-in token could be had): nothing
        // can have been deleted, so a later refusal must not be read as one.
        if (!failure.sent) return false;
        if (failure.status !== 0 && failure.status < 500) return false;
        // No answer, or the server failed part-way: it may have deleted the
        // account. Clerk knows whether the account is still there.
        maybeSentRef.current = true;
        const user = clerk.user;
        if (!user) return true;
        try {
            await user.reload();
            return false;
        } catch (reloadError) {
            return (
                isClerkAPIResponseError(reloadError) &&
                (reloadError.status === 401 || reloadError.status === 404)
            );
        }
    }

    async function remove() {
        if (!confirmed || submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        userIdRef.current ??= clerk.user?.id;
        const userId = userIdRef.current;
        try {
            await api.deleteAccount();
            await finish(userId);
        } catch (failure) {
            if (await accountGone(failure)) await finish(userId);
            else setError(t("deleteFailed"));
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
                <Text
                    variant="caption"
                    color={colors.destructive}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                >
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
