import { useClerk, useUser } from "@clerk/expo";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Card, ListRow, Screen, Text } from "@/components/ui";
import { LOCALES, LOCALE_LABELS, useLocale, useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

export default function AccountScreen() {
    const t = useTranslations("mobile.account");
    const f = useTranslations("mobile.foundation");
    const router = useRouter();
    const { user } = useUser();
    const { signOut } = useClerk();
    const [locale, setLocale] = useLocale();
    const [languagesOpen, setLanguagesOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const email = user?.primaryEmailAddress?.emailAddress;
    const displayName = user?.username || user?.fullName || email;

    async function logout() {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            // The root layout remounts the whole tree (and its query cache)
            // once Clerk reports signed out
            await signOut();
        } catch {
            setError(f("signOutError"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Screen edges={["top", "left", "right"]} contentContainerStyle={styles.content}>
            <Text variant="title">{t("title")}</Text>

            <View style={styles.identity}>
                {user?.imageUrl ? (
                    <Image
                        source={{ uri: user.imageUrl }}
                        style={styles.avatar}
                        accessibilityLabel={displayName}
                        cachePolicy="memory-disk"
                    />
                ) : null}
                <View style={styles.identityText}>
                    <Text variant="heading" numberOfLines={1}>
                        {displayName}
                    </Text>
                    {email && email !== displayName ? (
                        <Text variant="caption" numberOfLines={1}>
                            {email}
                        </Text>
                    ) : null}
                </View>
            </View>
            <Text variant="caption">{f("sharedAccount")}</Text>

            <Card padded={false}>
                <ListRow
                    icon="person-outline"
                    title={t("editProfile")}
                    onPress={() => router.push("/edit-profile")}
                />
                {user?.passwordEnabled ? (
                    <ListRow
                        icon="key-outline"
                        title={t("changePassword")}
                        onPress={() => router.push("/change-password")}
                    />
                ) : null}
                <ListRow
                    icon="language-outline"
                    title={t("language")}
                    value={LOCALE_LABELS[locale]}
                    trailing="none"
                    accessibilityState={{ expanded: languagesOpen }}
                    onPress={() => setLanguagesOpen((open) => !open)}
                    last={!languagesOpen}
                />
                {languagesOpen ? (
                    <View accessibilityRole="radiogroup" accessibilityLabel={t("language")}>
                        {LOCALES.map((option, index) => (
                            <ListRow
                                key={option}
                                title={LOCALE_LABELS[option]}
                                trailing="check"
                                inset
                                selected={option === locale}
                                accessibilityRole="radio"
                                last={index === LOCALES.length - 1}
                                onPress={() => {
                                    void setLocale(option);
                                    setLanguagesOpen(false);
                                }}
                            />
                        ))}
                    </View>
                ) : null}
            </Card>

            <Card padded={false}>
                <ListRow
                    icon="people-outline"
                    title={t("about")}
                    onPress={() => router.push("/about")}
                />
                <ListRow
                    icon="mail-outline"
                    title={f("contact")}
                    onPress={() => router.push("/contact")}
                />
                <ListRow
                    icon="shield-checkmark-outline"
                    title={t("privacy")}
                    onPress={() => router.push("/privacy")}
                    last
                />
            </Card>

            {error ? (
                <Text variant="caption" color={colors.destructive}>
                    {error}
                </Text>
            ) : null}

            <View style={styles.actions}>
                <Button
                    title={t("signOut")}
                    variant="outline"
                    loading={busy}
                    onPress={() => void logout()}
                />
                <Button
                    title={t("deleteAccount")}
                    variant="ghostDestructive"
                    disabled={busy}
                    onPress={() => router.push("/delete-account")}
                    style={styles.delete}
                />
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: { gap: spacing.lg, paddingTop: spacing.xl },
    identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    identityText: { flex: 1, gap: spacing.xs },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mutedSurface },
    actions: { gap: spacing.sm, marginTop: spacing.sm },
    delete: { alignSelf: "center" },
});
