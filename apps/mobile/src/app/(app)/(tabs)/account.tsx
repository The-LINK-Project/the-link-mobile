import { useClerk, useUser } from "@clerk/expo";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FirstLanguagePicker } from "@/components/language/FirstLanguagePicker";
import { Button, Card, ListRow, Screen, Text } from "@/components/ui";
import { FIRST_LANGUAGE_LABELS } from "@/lib/firstLanguage/languages";
import { useFirstLanguage } from "@/lib/firstLanguage/store";
import { LOCALES, LOCALE_LABELS, useLocale, useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

export default function AccountScreen() {
    const t = useTranslations("mobile.account");
    const f = useTranslations("mobile.foundation");
    const router = useRouter();
    const { user } = useUser();
    const { signOut } = useClerk();
    const [locale, setLocale] = useLocale();
    const [firstLanguage, setFirstLanguage] = useFirstLanguage();
    // One list at a time. Two open radio groups push everything below them off
    // the screen, and the two languages are easy enough to confuse already.
    const [openList, setOpenList] = useState<"app" | "first" | null>(null);
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
                    {/* A learner's own name and email are theirs. Holding a
                        finger on them must not send them anywhere to be
                        translated, so they are marked as not translatable. */}
                    <Text variant="heading" numberOfLines={1} translatable={false}>
                        {displayName}
                    </Text>
                    {email && email !== displayName ? (
                        <Text variant="caption" numberOfLines={1} translatable={false}>
                            {email}
                        </Text>
                    ) : null}
                </View>
            </View>
            <Text variant="caption">{f("sharedAccount")}</Text>

            <View style={styles.group}>
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
                        title={t("appLanguage")}
                        value={LOCALE_LABELS[locale]}
                        trailing="none"
                        accessibilityState={{ expanded: openList === "app" }}
                        onPress={() => setOpenList((open) => (open === "app" ? null : "app"))}
                    />
                    {openList === "app" ? (
                        <View accessibilityRole="radiogroup" accessibilityLabel={t("appLanguage")}>
                            {LOCALES.map((option) => (
                                <ListRow
                                    key={option}
                                    title={LOCALE_LABELS[option]}
                                    trailing="check"
                                    inset
                                    selected={option === locale}
                                    accessibilityRole="radio"
                                    onPress={() => {
                                        void setLocale(option);
                                        setOpenList(null);
                                    }}
                                />
                            ))}
                        </View>
                    ) : null}
                    <ListRow
                        icon="chatbubble-ellipses-outline"
                        title={t("myLanguage")}
                        value={firstLanguage ? FIRST_LANGUAGE_LABELS[firstLanguage] : undefined}
                        trailing="none"
                        accessibilityState={{ expanded: openList === "first" }}
                        onPress={() => setOpenList((open) => (open === "first" ? null : "first"))}
                        last={openList !== "first"}
                    />
                    {openList === "first" ? (
                        <FirstLanguagePicker
                            value={firstLanguage}
                            onChange={(language) => {
                                void setFirstLanguage(language);
                                setOpenList(null);
                            }}
                            label={t("myLanguage")}
                            inset
                        />
                    ) : null}
                </Card>
                {/* Under the card, where a settings list explains its last row.
                    The hint stays on show rather than hiding inside the open
                    list, because it is also where a learner finds out that
                    holding a word does anything at all. */}
                <Text variant="caption">{t("myLanguageHint")}</Text>
            </View>

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
    group: { gap: spacing.sm },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mutedSurface },
    actions: { gap: spacing.sm, marginTop: spacing.sm },
    delete: { alignSelf: "center" },
});
