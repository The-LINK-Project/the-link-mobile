import { Image } from "expo-image";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { FirstLanguagePicker } from "@/components/language/FirstLanguagePicker";
import { Button, Card, Screen, Text } from "@/components/ui";
import {
    FIRST_LANGUAGE_ONBOARDING_COPY,
    suggestFirstLanguage,
    type FirstLanguage,
} from "@/lib/firstLanguage/languages";
import { useFirstLanguage } from "@/lib/firstLanguage/store";
import { useTranslations } from "@/lib/i18n";
import { colors, spacing } from "@/lib/theme";

/**
 * The one question asked after a learner first signs in.
 *
 * There is no way past it and no way back out of it: the gate in the layout
 * keeps this the only screen until it is answered, so a learner cannot end up
 * in the app with the translation bubble having nothing to translate into.
 * Answering works with no connection at all, because the choice is saved on the
 * phone and copied to the server later.
 */
export default function ChooseLanguageScreen() {
    const t = useTranslations("mobile.firstLanguage");
    const [, setFirstLanguage] = useFirstLanguage();
    // The guess is taken once, when the screen opens. Recomputing it would let
    // it overrule a learner who has already tapped something else.
    const [chosen, setChosen] = useState<FirstLanguage | null>(() => suggestFirstLanguage());
    const [saving, setSaving] = useState(false);
    // Before a choice, use the app's current locale. Once someone taps their
    // language, explain the rest of this decision in that language right away.
    const copy = chosen
        ? FIRST_LANGUAGE_ONBOARDING_COPY[chosen]
        : {
              title: t("title"),
              body: t("body"),
              continue: t("continue"),
              changeLater: t("changeLater"),
          };

    async function save() {
        if (!chosen || saving) return;
        setSaving(true);
        // Saving lands in memory first, so the gate lets the learner in at once;
        // the disk and the server catch up behind them.
        await setFirstLanguage(chosen);
    }

    return (
        <Screen fixed padded={false} edges={["top", "bottom", "left", "right"]}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Image
                        source={require("../../../assets/images/icon.png")}
                        style={styles.logo}
                        contentFit="contain"
                        accessibilityLabel="The LINK Project"
                    />
                    <Text variant="title" center>
                        {copy.title}
                    </Text>
                    <Text center style={styles.body}>
                        {copy.body}
                    </Text>
                </View>

                <Card padded={false}>
                    <FirstLanguagePicker value={chosen} onChange={setChosen} label={copy.title} />
                </Card>
            </ScrollView>

            {/* Pinned, like the way forward in a lesson: with fifteen languages
                on a small phone the button would otherwise be off the screen. */}
            <View style={styles.footer}>
                <Button
                    title={copy.continue}
                    size="lg"
                    disabled={!chosen}
                    loading={saving}
                    onPress={() => void save()}
                />
                <Text variant="caption" center>
                    {copy.changeLater}
                </Text>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
    header: { alignItems: "center", gap: spacing.sm, paddingTop: spacing.lg },
    logo: { width: 72, height: 72, borderRadius: 18, marginBottom: spacing.sm },
    body: { maxWidth: 340 },
    footer: {
        gap: spacing.sm,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: colors.surface,
    },
});
