import { Image } from "expo-image";
import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Screen, Text } from "@/components/ui";
import { useTranslations } from "@/lib/i18n";
import { spacing } from "@/lib/theme";

const TEAM = [
    { name: "Adrish Majumder", image: require("../../../assets/about-us/mun.jpeg") },
    { name: "Alexandre Lee", image: require("../../../assets/about-us/Alex.jpeg") },
    { name: "Ruhan Gupta", image: require("../../../assets/about-us/Ruhan.jpeg") },
    { name: "Videep Agarwal", image: require("../../../assets/about-us/Videep.jpeg") },
];

export default function AboutScreen() {
    const t = useTranslations("aboutUs");

    return (
        <Screen contentContainerStyle={styles.content}>
            <Stack.Screen options={{ title: t("headerTitle") }} />
            <Text>{t("headerDescription")}</Text>
            <Text variant="heading">{t("headerCall")}</Text>
            <View style={styles.team}>
                {TEAM.map((member) => (
                    <View key={member.name} style={styles.member}>
                        <Image
                            source={member.image}
                            style={styles.photo}
                            accessibilityLabel={member.name}
                            contentFit="cover"
                        />
                        <View style={styles.memberText}>
                            <Text variant="bodyStrong">{member.name}</Text>
                            <Text variant="caption">{t("role")}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    content: { gap: spacing.xl },
    team: { gap: spacing.lg },
    member: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    memberText: { flex: 1 },
    photo: { width: 64, height: 64, borderRadius: 32 },
});
