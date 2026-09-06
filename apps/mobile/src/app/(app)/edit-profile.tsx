import { useUser } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Screen, Text, TextField } from "@/components/ui";
import { clerkErrorMessage } from "@/lib/clerkErrors";
import { USERNAME_PATTERN, useProfileAttributes } from "@/lib/clerkSettings";
import { useTranslations } from "@/lib/i18n";
import { queryKeys } from "@/lib/queries";
import { colors, spacing } from "@/lib/theme";

// Edits whichever profile fields the Clerk instance has enabled (username on
// ours; first/last name where the dashboard turns them on). Avatar upload is
// deliberately not here — it needs an image-picker dependency and a Play
// data-safety entry, so it stays a separate TODO item.
export default function EditProfileScreen() {
    const t = useTranslations("mobile.account");
    const router = useRouter();
    const { user } = useUser();
    const queryClient = useQueryClient();
    const attributes = useProfileAttributes();

    const [username, setUsername] = useState(user?.username ?? "");
    const [firstName, setFirstName] = useState(user?.firstName ?? "");
    const [lastName, setLastName] = useState(user?.lastName ?? "");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submittingRef = useRef(false);

    const usernameOk =
        !attributes.username.enabled ||
        (username.trim() === "" && !attributes.username.required) ||
        USERNAME_PATTERN.test(username.trim());
    const firstNameOk =
        !attributes.firstName.enabled || !attributes.firstName.required || !!firstName.trim();
    const lastNameOk =
        !attributes.lastName.enabled || !attributes.lastName.required || !!lastName.trim();
    const canSave = usernameOk && firstNameOk && lastNameOk;

    const save = useCallback(async () => {
        if (!user || !canSave || submittingRef.current) return;
        submittingRef.current = true;
        setBusy(true);
        setError(null);
        try {
            await user.update({
                ...(attributes.username.enabled ? { username: username.trim() } : {}),
                ...(attributes.firstName.enabled ? { firstName: firstName.trim() } : {}),
                ...(attributes.lastName.enabled ? { lastName: lastName.trim() } : {}),
            });
            // GET /v1/me re-syncs the Mongo copy from Clerk on its next read,
            // so drop the cached profile
            queryClient.invalidateQueries({ queryKey: queryKeys.me });
            router.back();
        } catch (err) {
            setError(clerkErrorMessage(err, t("genericError")));
        } finally {
            submittingRef.current = false;
            setBusy(false);
        }
    }, [attributes, canSave, firstName, lastName, queryClient, router, t, user, username]);

    return (
        <Screen edges={["bottom", "left", "right"]}>
            <Stack.Screen options={{ title: t("editProfile") }} />
            <View style={styles.container}>
                <View style={styles.form}>
                    {attributes.username.enabled ? (
                        <TextField
                            label={t("username")}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="username"
                            textContentType="username"
                            onSubmitEditing={save}
                        />
                    ) : null}
                    {attributes.firstName.enabled ? (
                        <TextField
                            label={t("firstName")}
                            value={firstName}
                            onChangeText={setFirstName}
                            autoComplete="given-name"
                            textContentType="givenName"
                            onSubmitEditing={save}
                        />
                    ) : null}
                    {attributes.lastName.enabled ? (
                        <TextField
                            label={t("lastName")}
                            value={lastName}
                            onChangeText={setLastName}
                            autoComplete="family-name"
                            textContentType="familyName"
                            onSubmitEditing={save}
                        />
                    ) : null}

                    {error ? (
                        <Text variant="caption" color={colors.destructive}>
                            {error}
                        </Text>
                    ) : null}

                    <Button
                        title={t("save")}
                        size="lg"
                        loading={busy}
                        disabled={!canSave}
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
