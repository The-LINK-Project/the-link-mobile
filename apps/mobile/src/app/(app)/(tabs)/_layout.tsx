import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";

import { useTranslations } from "@/lib/i18n";
import { colors } from "@/lib/theme";

export default function TabLayout() {
    const t = useTranslations("mobile.foundation");
    const a = useTranslations("mobile.account");

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primaryDark,
                tabBarInactiveTintColor: colors.muted,
                tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: t("home"),
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="account"
                options={{
                    title: a("title"),
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? "person" : "person-outline"} color={color} size={size} />
                    ),
                }}
            />
        </Tabs>
    );
}
