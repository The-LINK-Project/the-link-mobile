import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { spacing } from "@/lib/theme";

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <View style={styles.header}>
            <Image
                source={require("../../../assets/images/icon.png")}
                style={styles.logo}
                contentFit="contain"
                accessibilityLabel="The LINK Project"
            />
            <Text variant="title" center>
                {title}
            </Text>
            <Text variant="caption" center>
                {subtitle}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
    logo: { width: 72, height: 72, borderRadius: 18, marginBottom: spacing.sm },
});
